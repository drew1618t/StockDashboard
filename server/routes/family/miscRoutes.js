const express = require('express');
const fs = require('fs');
const path = require('path');

function createFamilyMiscRoutes(options = {}) {
  const router = express.Router();
  const investmentDataDir = options.privateInvestmentDataDir
    || path.join(__dirname, '..', '..', '..', 'data', 'private-investments');

  router.get('/medical/summary', (req, res) => {
    res.status(501).json({
      error: 'Medical summary is not implemented yet',
      section: 'medical',
      role: req.user.role,
    });
  });

  router.get('/cameras', (req, res) => {
    res.status(501).json({
      error: 'Camera APIs are not implemented yet',
      section: 'cameras',
      role: req.user.role,
    });
  });

  router.get('/investments/:viewName', (req, res) => {
    const allowedViews = new Set(['tracker', 'study']);
    if (!allowedViews.has(req.params.viewName)) {
      return res.status(404).json({ error: 'Private investment view not found' });
    }

    const filePath = path.join(investmentDataDir, `${req.params.viewName}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(503).json({ error: 'Private investment data is not available on this server' });
    }

    res.setHeader('Cache-Control', 'private, no-store');
    return res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  });

  return router;
}

module.exports = {
  createFamilyMiscRoutes,
};
