/**
 * local.js — Local development server that bypasses Cloudflare Access auth.
 * Usage: node local.js
 */
const { prepareData, createApp } = require('./server/index');

const PORT = process.env.PORT || 3000;

prepareData();

// Create app with a no-op auth middleware that grants family role
const app = createApp({
  accessAuth: (req, res, next) => {
    req.user = { email: 'local@dev', role: 'family' };
    next();
  },
});

app.listen(PORT, () => {
  console.log(`[local] Dashboard running at http://localhost:${PORT}`);
  console.log(`[local] Deep Dive: http://localhost:${PORT}/dashboard.html#deepdive`);
});
