const express = require('express');

const { requireRole } = require('../auth/authorize');
const defaultDataLoader = require('../dataLoader');
const defaultSheetsPoller = require('../sheetsPoller');

function round2(n) {
  return Math.round(n * 100) / 100;
}

function buildLivePriceMap(sheetsPoller) {
  const live = sheetsPoller.getLiveData();
  if (!live || !live.stocks) return {};
  const map = {};
  live.stocks.forEach(stock => {
    if (stock.currentPrice) map[stock.ticker] = stock.currentPrice;
  });
  return map;
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

function overlayLivePrices(companies, sheetsPoller) {
  const priceMap = buildLivePriceMap(sheetsPoller);
  return companies.map(company => {
    const livePrice = priceMap[company.ticker];
    if (livePrice) return overlayLivePrice(company, livePrice);
    return { ...company, priceSource: 'report' };
  });
}

function createPortfolioRoutes(options = {}) {
  const dataLoader = options.dataLoader || defaultDataLoader;
  const sheetsPoller = options.sheetsPoller || defaultSheetsPoller;
  const requireFamily = options.requireFamily || requireRole('family');
  const router = express.Router();

  router.get('/api/portfolio', (req, res) => {
    const companies = overlayLivePrices(dataLoader.getCompanies(), sheetsPoller);
    res.json({
      companies,
      count: companies.length,
      holdings: dataLoader.getPortfolioHoldings(),
      lastUpdated: dataLoader.getLastLoadTime(),
    });
  });

  router.get('/api/stock/:ticker', (req, res) => {
    const { company, analysis, rawMarkdown } = dataLoader.getCompany(req.params.ticker);
    if (!company) {
      return res.status(404).json({ error: `Ticker ${req.params.ticker} not found` });
    }
    const [overlaid] = overlayLivePrices([company], sheetsPoller);
    return res.json({ company: overlaid, analysis, rawMarkdown });
  });

  router.get('/api/available-tickers', (req, res) => {
    res.json(dataLoader.getAvailableTickers());
  });

  router.get('/api/non-portfolio-companies', (req, res) => {
    const companies = typeof dataLoader.getNonPortfolioCompanies === 'function'
      ? dataLoader.getNonPortfolioCompanies()
      : [];
    res.json({
      companies: overlayLivePrices(companies, sheetsPoller),
      count: companies.length,
      lastUpdated: dataLoader.getLastLoadTime(),
    });
  });

  router.get('/api/refresh', requireFamily, (req, res) => {
    const companies = dataLoader.refresh();
    res.json({
      message: 'Data refreshed',
      count: companies.length,
      lastUpdated: dataLoader.getLastLoadTime(),
    });
  });

  router.get('/api/live-portfolio', (req, res) => {
    res.json(sheetsPoller.getLiveData());
  });

  router.get('/api/live-portfolio/refresh', requireFamily, async (req, res) => {
    try {
      const data = await sheetsPoller.forceRefresh();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to refresh live data' });
    }
  });

  router.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      companiesLoaded: dataLoader.getCompanies().length,
      lastUpdated: dataLoader.getLastLoadTime(),
    });
  });

  return router;
}

module.exports = {
  createPortfolioRoutes,
  overlayLivePrice,
  overlayLivePrices,
};
