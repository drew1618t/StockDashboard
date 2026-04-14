const express = require('express');

const defaultRequestTracker = require('../requestTracker');

function createRequestRoutes(options = {}) {
  const requestTracker = options.requestTracker || defaultRequestTracker;
  const router = express.Router();

  router.get('/api/requests', (req, res) => {
    res.json(requestTracker.getRequests());
  });

  router.post('/api/requests', (req, res) => {
    const ticker = (req.body.ticker || '').trim().toUpperCase();
    if (!ticker) return res.status(400).json({ error: 'Ticker required' });
    if (!/^[A-Z]{1,6}$/.test(ticker)) return res.status(400).json({ error: 'Invalid ticker format' });
    const result = requestTracker.addRequest(ticker);
    return res.json(result);
  });

  return router;
}

module.exports = {
  createRequestRoutes,
};
