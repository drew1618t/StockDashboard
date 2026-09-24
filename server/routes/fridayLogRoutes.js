const express = require('express');
const multer = require('multer');
const { requireRole } = require('../auth/authorize');
const { service: defaultService } = require('../fridayLogService');

/** Expose the private Friday ledger and bounded transaction imports to family accounts only. */
function createFridayLogRoutes(options = {}) {
  const router = express.Router();
  const service = options.fridayLogService || defaultService;
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
  router.use('/api/friday-log', options.requireFamily || requireRole('family'));
  router.use('/api/friday-log', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  router.get('/api/friday-log', (req, res) => {
    try {
      res.json(service.store.getYear(Number(req.query.year || new Date().getFullYear()), req.query.account || 'all'));
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  router.post('/api/friday-log/refresh', async (req, res) => {
    try { res.json(await service.refresh()); }
    catch (err) { res.status(500).json({ error: 'Could not refresh Friday closing prices. Saved data is preserved.' }); }
  });
  router.post('/api/friday-log/import', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Choose a Schwab transaction CSV' });
      const result = service.store.importCsv(req.body.account, req.file.buffer.toString('utf8'), req.body.through, req.file.originalname);
      await service.refresh();
      return res.json(result);
    } catch (err) { return res.status(400).json({ error: err.message }); }
  });
  router.use('/api/friday-log', (err, req, res, next) => {
    if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Choose one CSV smaller than 2 MB' });
    return next(err);
  });
  return router;
}

module.exports = { createFridayLogRoutes };
