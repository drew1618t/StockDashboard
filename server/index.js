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
const requestTracker = require('./requestTracker');

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;

// ── Live Price Overlay ──────────────────────────────────────────────────────

function buildLivePriceMap() {
  const live = sheetsPoller.getLiveData();
  if (!live || !live.stocks) return {};
  const map = {};
  live.stocks.forEach(s => { if (s.currentPrice) map[s.ticker] = s.currentPrice; });
  return map;
}

function round2(n) { return Math.round(n * 100) / 100; }

function overlayLivePrice(company, livePrice) {
  const reportPrice = company.price;
  if (!reportPrice || reportPrice <= 0) {
    return { ...company, price: livePrice, priceSource: 'live' };
  }

  const ratio = livePrice / reportPrice;
  const c = {
    ...company,
    price: livePrice,
    priceSource: 'live',
    marketCapMil: company.marketCapMil ? round2(company.marketCapMil * ratio) : null,
    priceToSales: company.priceToSales ? round2(company.priceToSales * ratio) : null,
  };

  // Recalculate P/E variants: back-derive EPS, then recompute with live price
  ['trailingPe', 'runRatePe', 'forwardPe', 'normalizedPe'].forEach(key => {
    if (company[key] && reportPrice) {
      const eps = reportPrice / company[key];
      c[key] = round2(livePrice / eps);
    }
  });

  // Recalculate derived metrics that depend on price
  const calc = { ...company.calculated };

  // Distance from 52-week high
  if (company.fiftyTwoWeekHigh) {
    calc.distanceFromHigh = round2(((livePrice - company.fiftyTwoWeekHigh) / company.fiftyTwoWeekHigh) * 100);
  }

  // GAV: effective P/E ÷ revenue growth
  const pe = c.runRatePe || c.trailingPe || c.normalizedPe;
  if (pe && company.revenueYoyPct && company.revenueYoyPct > 0) {
    calc.gav = round2(pe / company.revenueYoyPct);
  }

  // P/E compression
  if (c.trailingPe !== null || c.runRatePe !== null || c.forwardPe !== null) {
    calc.peCompression = {
      trailingPe: c.trailingPe,
      runRatePe: c.runRatePe,
      forwardPe: c.forwardPe,
      trailingToRunRate: (c.trailingPe != null && c.runRatePe != null) ? round2(c.trailingPe - c.runRatePe) : null,
      runRateToForward: (c.runRatePe != null && c.forwardPe != null) ? round2(c.runRatePe - c.forwardPe) : null,
      totalCompression: (c.trailingPe != null && c.forwardPe != null) ? round2(c.trailingPe - c.forwardPe) : null,
    };
  }

  c.calculated = calc;
  return c;
}

function overlayLivePrices(companies) {
  const priceMap = buildLivePriceMap();
  return companies.map(company => {
    const livePrice = priceMap[company.ticker];
    if (livePrice) return overlayLivePrice(company, livePrice);
    return { ...company, priceSource: 'report' };
  });
}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(compression());
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1h',
  etag: true,
}));

// ── API Routes ───────────────────────────────────────────────────────────────

// Get all portfolio companies with calculated metrics
app.get('/api/portfolio', (req, res) => {
  const companies = overlayLivePrices(dataLoader.getCompanies());
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
  const [overlaid] = overlayLivePrices([company]);
  res.json({ company: overlaid, analysis, rawMarkdown });
});

// Get all available tickers (portfolio + non-portfolio for comparisons)
app.get('/api/available-tickers', (req, res) => {
  res.json(dataLoader.getAvailableTickers());
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
    res.status(500).json({ error: 'Failed to refresh live data' });
  }
});

// Comparison requests — track tickers without data
app.get('/api/requests', (req, res) => {
  res.json(requestTracker.getRequests());
});

app.post('/api/requests', (req, res) => {
  const ticker = (req.body.ticker || '').trim().toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'Ticker required' });
  if (!/^[A-Z]{1,6}$/.test(ticker)) return res.status(400).json({ error: 'Invalid ticker format' });
  const result = requestTracker.addRequest(ticker);
  res.json(result);
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

// ── Privacy policy (required for Facebook auth) ─────────────────────────────

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'privacy.html'));
});

// ── Requests page ────────────────────────────────────────────────────────────

app.get('/requests', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'requests.html'));
});

// ── Dashboard route (existing SPA) ──────────────────────────────────────────

app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html')));

// ── SPA fallback ────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
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
