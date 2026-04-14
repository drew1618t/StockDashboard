const express = require('express');

const defaultTaxStore = require('../../taxStore');

function createTaxRoutes(options = {}) {
  const taxStore = options.taxStore || defaultTaxStore;
  const router = express.Router();

  router.get('/taxes', async (req, res) => {
    try {
      res.json(await taxStore.getTaxes());
    } catch (err) {
      console.warn(`[taxes] failed to load taxes: ${err.message}`);
      res.status(500).json({ error: 'Failed to load tax dashboard data' });
    }
  });

  router.patch('/taxes/carryover', (req, res) => {
    const result = taxStore.updateCarryoverLoss(req.body.taxYear, req.body.amount);
    if (!result) return res.status(400).json({ error: 'Valid taxYear and amount are required' });
    res.json(result);
  });

  router.patch('/taxes/sales/:saleId', (req, res) => {
    const result = taxStore.updateSaleConfirmation(req.params.saleId, req.body);
    if (!result) return res.status(400).json({ error: 'Valid sale confirmation data is required' });
    res.json(result);
  });

  router.patch('/taxes/planner', (req, res) => {
    const result = taxStore.updatePlanner(req.body || {});
    if (!result) return res.status(400).json({ error: 'Valid planner data is required' });
    res.json(result);
  });

  return router;
}

module.exports = {
  createTaxRoutes,
};
