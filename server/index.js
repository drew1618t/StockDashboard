const dataLoader = require('./dataLoader');
const sheetsPoller = require('./sheetsPoller');
const { createApp } = require('./createApp');
const { importExistingPigeonDataIfNeeded } = require('./pigeonImport');

const PORT = process.env.PORT || 3000;

function prepareData() {
  console.log('[server] Loading data...');
  dataLoader.loadAll();

  console.log('[server] Starting Google Sheets polling...');
  sheetsPoller.startPolling();

  console.log('[server] Preparing pigeon data...');
  try {
    const pigeonImportResult = importExistingPigeonDataIfNeeded();
    if (pigeonImportResult.imported) {
      console.log(`[server] Imported pigeon data: ${pigeonImportResult.birds} birds, ${pigeonImportResult.medications} medications`);
    } else {
      console.log(`[server] Pigeon import skipped: ${pigeonImportResult.reason}`);
    }
  } catch (err) {
    console.warn(`[server] Pigeon import failed: ${err.message}`);
  }
}

let app = null;

if (require.main === module) {
  prepareData();
  app = createApp();
  app.listen(PORT, () => {
    console.log(`[server] Portfolio dashboard running at http://localhost:${PORT}`);
    console.log(`[server] Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  });
}

module.exports = {
  app,
  createApp,
  prepareData,
};
