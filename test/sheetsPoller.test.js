const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  parseCSV,
  persistSnapshot,
  readPersistedSnapshot,
} = require('../server/sheetsPoller');

test('parseCSV reads daily change from current Google Sheets column layout', () => {
  const csv = [
    '"","","","","","","","","","","","","","","","","","","","","","","","","","","","total"," $ 966,850.43 "',
    '"ALAB","927","20.67%","215.58","","199842.66","","","","","","","","$55.82","$51,745.14","286.21%","","148,097.52","-15851.7","","","-7.35"',
    '"APP","362","18.44%","492.38","","178241.56","","","","","","","","$131.50","$47,603.00","274.43%","","130,638.56","-3120.44","","","-1.72"',
    '"Cash","124,434.25","12.87%","1","","124434.25"',
    '"","","","","","","","","","","","","","","","","","391,160.45"',
    '"","","","","","","","","","","","","","","","","","","-41625.24","","%","-4.31%"',
    '"Start of the Year","$915,398.55"',
    '"YTD Change"," $ 51,451.88 "',
    '"Percent Change","7.04%"',
  ].join('\n');

  const data = parseCSV(csv);

  assert.equal(data.stocks.length, 2);
  assert.equal(data.stocks[0].ticker, 'ALAB');
  assert.equal(data.stocks[0].dayChangePct, -7.35);
  assert.equal(data.stocks[1].dayChangePct, -1.72);
  assert.equal(data.portfolioMetrics.dayChangePct, -4.31);
});

test('persisted portfolio snapshot round-trips for offline consumers', t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-dashboard-snapshot-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const snapshotPath = path.join(tempDir, 'live-portfolio-snapshot.json');
  const snapshot = {
    stocks: [{ ticker: 'APP', shares: 2, weightPct: 12.5 }],
    cash: { value: 100, weightPct: 1 },
    portfolioMetrics: { totalValue: 1000 },
    lastFetchTime: '2026-08-11T12:00:00.000Z',
    source: 'google-sheets-live',
    stale: false,
  };

  persistSnapshot(snapshot, snapshotPath);

  assert.deepEqual(readPersistedSnapshot(snapshotPath), snapshot);
});

test('invalid persisted portfolio snapshots fail closed', t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-dashboard-snapshot-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const snapshotPath = path.join(tempDir, 'live-portfolio-snapshot.json');
  fs.writeFileSync(snapshotPath, '{"stocks":"invalid"}');

  assert.equal(readPersistedSnapshot(snapshotPath), null);
  assert.throws(
    () => persistSnapshot({ stocks: [] }, snapshotPath),
    /invalid live portfolio snapshot/
  );
});
