const express = require('express');
const path = require('path');

const { renderHomePage } = require('../homePage');

function createStaticPageRoutes() {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.type('html').send(renderHomePage(req.user));
  });

  router.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'privacy.html'));
  });

  router.get('/requests', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'requests.html'));
  });

  router.get('/dashboard', (req, res) =>
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'dashboard.html'))
  );

  router.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'dashboard.html'));
  });

  return router;
}

module.exports = {
  createStaticPageRoutes,
};
