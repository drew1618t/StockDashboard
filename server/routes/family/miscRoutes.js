const express = require('express');

function createFamilyMiscRoutes() {
  const router = express.Router();

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

  return router;
}

module.exports = {
  createFamilyMiscRoutes,
};
