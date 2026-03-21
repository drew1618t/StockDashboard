/**
 * server/index.js - Express server for the portfolio visualization dashboard.
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
const { createAccessAuth } = require('./auth/accessAuth');
const { authErrorHandler, requireAuth, requireRole } = require('./auth/authorize');
const {
  renderFamilyHubPage,
  renderFamilySectionPage,
  renderFamilyHealthChooserPage,
  renderPersonHealthPage,
} = require('./familyPages');
const todoStore = require('./todoStore');
const pinboardStore = require('./pinboardStore');
const { renderHomePage } = require('./homePage');

const PORT = process.env.PORT || 3000;
const accessAuth = createAccessAuth();

function buildLivePriceMap() {
  const live = sheetsPoller.getLiveData();
  if (!live || !live.stocks) return {};
  const map = {};
  live.stocks.forEach(stock => {
    if (stock.currentPrice) map[stock.ticker] = stock.currentPrice;
  });
  return map;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function overlayLivePrice(company, livePrice) {
  const reportPrice = company.price;
  if (!reportPrice || reportPrice <= 0) {
    return { ...company, price: livePrice, priceSource: 'live' };
  }

  const ratio = livePrice / reportPrice;
  const nextCompany = {
    ...company,
    price: livePrice,
    priceSource: 'live',
    marketCapMil: company.marketCapMil ? round2(company.marketCapMil * ratio) : null,
    priceToSales: company.priceToSales ? round2(company.priceToSales * ratio) : null,
  };

  ['trailingPe', 'runRatePe', 'forwardPe', 'normalizedPe'].forEach(key => {
    if (company[key] && reportPrice) {
      const eps = reportPrice / company[key];
      nextCompany[key] = round2(livePrice / eps);
    }
  });

  const calc = { ...company.calculated };

  if (company.fiftyTwoWeekHigh) {
    calc.distanceFromHigh = round2(((livePrice - company.fiftyTwoWeekHigh) / company.fiftyTwoWeekHigh) * 100);
  }

  const pe = nextCompany.runRatePe || nextCompany.trailingPe || nextCompany.normalizedPe;
  if (pe && company.revenueYoyPct && company.revenueYoyPct > 0) {
    calc.gav = round2(pe / company.revenueYoyPct);
  }

  if (nextCompany.trailingPe !== null || nextCompany.runRatePe !== null || nextCompany.forwardPe !== null) {
    calc.peCompression = {
      trailingPe: nextCompany.trailingPe,
      runRatePe: nextCompany.runRatePe,
      forwardPe: nextCompany.forwardPe,
      trailingToRunRate:
        nextCompany.trailingPe != null && nextCompany.runRatePe != null
          ? round2(nextCompany.trailingPe - nextCompany.runRatePe)
          : null,
      runRateToForward:
        nextCompany.runRatePe != null && nextCompany.forwardPe != null
          ? round2(nextCompany.runRatePe - nextCompany.forwardPe)
          : null,
      totalCompression:
        nextCompany.trailingPe != null && nextCompany.forwardPe != null
          ? round2(nextCompany.trailingPe - nextCompany.forwardPe)
          : null,
    };
  }

  nextCompany.calculated = calc;
  return nextCompany;
}

function overlayLivePrices(companies) {
  const priceMap = buildLivePriceMap();
  return companies.map(company => {
    const livePrice = priceMap[company.ticker];
    if (livePrice) return overlayLivePrice(company, livePrice);
    return { ...company, priceSource: 'report' };
  });
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(compression());
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'"
    );
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(accessAuth);
  app.use(authErrorHandler);
  app.use(requireAuth);

  app.get('/', (req, res) => {
    res.type('html').send(renderHomePage(req.user));
  });

  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      maxAge: '1h',
      etag: true,
    })
  );

  app.get('/api/me', (req, res) => {
    res.json({
      authenticated: true,
      email: req.user.email,
      role: req.user.role,
    });
  });

  app.get('/api/portfolio', (req, res) => {
    const companies = overlayLivePrices(dataLoader.getCompanies());
    res.json({
      companies,
      count: companies.length,
      holdings: dataLoader.getPortfolioHoldings(),
      lastUpdated: dataLoader.getLastLoadTime(),
    });
  });

  app.get('/api/stock/:ticker', (req, res) => {
    const { company, analysis, rawMarkdown } = dataLoader.getCompany(req.params.ticker);
    if (!company) {
      return res.status(404).json({ error: `Ticker ${req.params.ticker} not found` });
    }
    const [overlaid] = overlayLivePrices([company]);
    return res.json({ company: overlaid, analysis, rawMarkdown });
  });

  app.get('/api/available-tickers', (req, res) => {
    res.json(dataLoader.getAvailableTickers());
  });

  app.get('/api/refresh', (req, res) => {
    const companies = dataLoader.refresh();
    res.json({
      message: 'Data refreshed',
      count: companies.length,
      lastUpdated: dataLoader.getLastLoadTime(),
    });
  });

  app.get('/api/live-portfolio', (req, res) => {
    res.json(sheetsPoller.getLiveData());
  });

  app.get('/api/live-portfolio/refresh', async (req, res) => {
    try {
      const data = await sheetsPoller.forceRefresh();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to refresh live data' });
    }
  });

  app.get('/api/requests', (req, res) => {
    res.json(requestTracker.getRequests());
  });

  app.post('/api/requests', (req, res) => {
    const ticker = (req.body.ticker || '').trim().toUpperCase();
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });
    if (!/^[A-Z]{1,6}$/.test(ticker)) return res.status(400).json({ error: 'Invalid ticker format' });
    const result = requestTracker.addRequest(ticker);
    return res.json(result);
  });

  app.use('/api/family', requireRole('family'));

  app.get('/api/family/medical/summary', (req, res) => {
    res.status(501).json({
      error: 'Medical summary is not implemented yet',
      section: 'medical',
      role: req.user.role,
    });
  });

  app.get('/api/family/todos', (req, res) => {
    res.json(todoStore.getTodos());
  });

  app.get('/api/family/pinboard', (req, res) => {
    res.json(pinboardStore.getNotes());
  });

  app.post('/api/family/pinboard', (req, res) => {
    const note = pinboardStore.addNote(req.body.text, req.body.author);
    if (!note) return res.status(400).json({ error: 'Text is required' });
    res.status(201).json(note);
  });

  app.patch('/api/family/pinboard/:id', (req, res) => {
    const note = pinboardStore.updateNote(req.params.id, req.body);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  });

  app.delete('/api/family/pinboard/:id', (req, res) => {
    const ok = pinboardStore.deleteNote(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Note not found' });
    res.json({ deleted: true });
  });

  app.post('/api/family/todos', (req, res) => {
    const { text, assignee, note, section, category } = req.body;
    const todo = todoStore.addTodo(text, { assignee, note, section, category });
    if (!todo) return res.status(400).json({ error: 'Text is required' });
    res.status(201).json(todo);
  });

  app.post('/api/family/todos/category', (req, res) => {
    const cat = todoStore.addCategory(req.body.name);
    if (!cat) return res.status(400).json({ error: 'Category name is required' });
    res.status(201).json(cat);
  });

  app.patch('/api/family/todos/:id/toggle', (req, res) => {
    const todo = todoStore.toggleTodo(req.params.id);
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    res.json(todo);
  });

  app.patch('/api/family/todos/:id', (req, res) => {
    const todo = todoStore.updateTodo(req.params.id, req.body);
    if (!todo) return res.status(404).json({ error: 'Todo not found' });
    res.json(todo);
  });

  app.delete('/api/family/todos/:id', (req, res) => {
    const ok = todoStore.deleteTodo(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Todo not found' });
    res.json({ deleted: true });
  });

  app.post('/api/family/todos/:id/project', (req, res) => {
    const item = todoStore.makeProject(req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Todo not found or invalid' });
    res.json(item);
  });

  app.post('/api/family/todos/:id/subtask', (req, res) => {
    const { phase, text } = req.body;
    const sub = todoStore.addSubTask(req.params.id, phase, text);
    if (!sub) return res.status(400).json({ error: 'Could not add sub-task' });
    res.status(201).json(sub);
  });

  app.post('/api/family/todos/:id/decision', (req, res) => {
    const entry = todoStore.addDecisionLogEntry(req.params.id, req.body.entry);
    if (!entry) return res.status(400).json({ error: 'Could not add decision log entry' });
    res.status(201).json(entry);
  });

  app.get('/api/family/cameras', (req, res) => {
    res.status(501).json({
      error: 'Camera APIs are not implemented yet',
      section: 'cameras',
      role: req.user.role,
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      companiesLoaded: dataLoader.getCompanies().length,
      lastUpdated: dataLoader.getLastLoadTime(),
    });
  });

  app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'privacy.html'));
  });

  app.get('/requests', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'requests.html'));
  });

  app.use('/family', requireRole('family'));

  app.get('/family', requireRole('family'), (req, res) => {
    res.type('html').send(renderFamilyHubPage());
  });

  app.get('/family/health', requireRole('family'), (req, res) => {
    res.type('html').send(renderFamilyHealthChooserPage());
  });

  app.get('/family/health/andrew', requireRole('family'), (req, res) => {
    res.type('html').send(renderPersonHealthPage('Andrew'));
  });

  app.get('/family/health/kaili', requireRole('family'), (req, res) => {
    res.type('html').send(renderPersonHealthPage('Kaili'));
  });

  app.get('/family/medical', requireRole('family'), (req, res) => {
    res.redirect('/family/health');
  });

  app.get('/family/todos', requireRole('family'), (req, res) => {
    res.type('html').send(
      renderFamilySectionPage(
        'Shared ToDos',
        'Protected placeholder for shared task lists, routines, and household follow-up items.'
      )
    );
  });

  app.get('/family/cameras', requireRole('family'), (req, res) => {
    res.type('html').send(
      renderFamilySectionPage(
        'Camera Monitor',
        'Protected placeholder for security camera dashboards, snapshots, and future live feeds.'
      )
    );
  });

  app.get('/family/*', (req, res) => {
    res.status(404).type('html').send(
      renderFamilySectionPage(
        'Family Page Not Found',
        'This protected family route does not exist yet. The authorization boundary is still being enforced correctly.'
      )
    );
  });

  app.get('/dashboard', (req, res) =>
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'))
  );

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
  });

  return app;
}

console.log('[server] Loading data...');
dataLoader.loadAll();

console.log('[server] Starting Google Sheets polling...');
sheetsPoller.startPolling();

const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[server] Portfolio dashboard running at http://localhost:${PORT}`);
    console.log(`[server] Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  });
}

module.exports = {
  app,
  createApp,
};
