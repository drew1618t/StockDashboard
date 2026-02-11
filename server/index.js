/**
 * server/index.js — Express server for the portfolio visualization dashboard.
 *
 * Serves static files from /public and provides JSON API endpoints.
 * All data is loaded into memory at startup from the reports directory.
 */

const express = require('express');
const compression = require('compression');
const path = require('path');
const dataLoader = require('./dataLoader');
const sheetsPoller = require('./sheetsPoller');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(compression());
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1h',
  etag: true,
}));

// ── API Routes ───────────────────────────────────────────────────────────────

// Get all portfolio companies with calculated metrics
app.get('/api/portfolio', (req, res) => {
  const companies = dataLoader.getCompanies();
  res.json({
    companies,
    count: companies.length,
    holdings: dataLoader.getPortfolioHoldings(),
    lastUpdated: dataLoader.getLastLoadTime(),
  });
});

// Get a single company with full analysis data
app.get('/api/stock/:ticker', (req, res) => {
  const { company, analysis, rawMarkdown } = dataLoader.getCompany(req.params.ticker);
  if (!company) {
    return res.status(404).json({ error: `Ticker ${req.params.ticker} not found` });
  }
  res.json({ company, analysis, rawMarkdown });
});

// Force reload all data from disk
app.get('/api/refresh', (req, res) => {
  const companies = dataLoader.refresh();
  res.json({
    message: 'Data refreshed',
    count: companies.length,
    lastUpdated: dataLoader.getLastLoadTime(),
  });
});

// Get live portfolio data from Google Sheets
app.get('/api/live-portfolio', (req, res) => {
  res.json(sheetsPoller.getLiveData());
});

// Force refresh live portfolio data
app.get('/api/live-portfolio/refresh', async (req, res) => {
  try {
    const data = await sheetsPoller.forceRefresh();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    companiesLoaded: dataLoader.getCompanies().length,
    lastUpdated: dataLoader.getLastLoadTime(),
  });
});

// ── SPA fallback: serve index.html for any non-API, non-static route ─────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Startup ──────────────────────────────────────────────────────────────────

console.log('[server] Loading data...');
dataLoader.loadAll();

console.log('[server] Starting Google Sheets polling...');
sheetsPoller.startPolling();

app.listen(PORT, () => {
  console.log(`[server] Portfolio dashboard running at http://localhost:${PORT}`);
  console.log(`[server] Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});
