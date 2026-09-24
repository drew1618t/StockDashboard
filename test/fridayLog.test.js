const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { createFridayLogStore, parseTransactions, effect, fridays, marketTime, ACCOUNTS } = require('../server/fridayLogStore');
const { normalizeChart, createFridayLogService } = require('../server/fridayLogService');
const { createFridayLogRoutes } = require('../server/routes/fridayLogRoutes');

/** Create a Schwab fixture without embedding any private account records. */
function csv(rows) {
  return ['Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount', ...rows].join('\n');
}

/** Build a funded, covered portfolio with deterministic prices and a fixed exchange-local clock. */
function fixture(t, now = '2026-01-10T12:00:00Z') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'friday-log-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createFridayLogStore({ root, now: () => new Date(now) });
  for (const account of Object.keys(ACCOUNTS)) store.importCsv(account, csv(['01/01/2026,Bank Interest,,,,,,0']), '2026-01-09');
  store.setAnchor('all', { date: '2026-01-09', cash: 450, positions: [{ symbol: 'ABC', shares: 15 }], source: 'Test reference' });
  const closes = { '2025-12-26': 10, '2025-12-31': 10, '2026-01-02': 10, '2026-01-09': 11 };
  store.savePrices({ symbols: { ABC: { closes, splits: [] }, SPY: { closes, splits: [] } }, updatedAt: now, errors: {} });
  return { store, root };
}

test('reverse trades preserve funded starting balances and portfolio return includes trading cash', t => {
  const { store } = fixture(t);
  store.importCsv('drew-roth', csv(['01/05/2026,Buy,ABC,Example,5,10,0,-50']), '2026-01-09');
  const weeks = store.getYear(2026).weeks;
  assert.equal(weeks[0].holdings[0].shares, 10);
  assert.equal(weeks[0].cash, 500);
  assert.equal(weeks[0].total, 600);
  assert.equal(weeks[1].total, 615);
  assert.equal(weeks[1].profit, 15);
  assert.equal(weeks[1].weekPct, 2.5);
  assert.equal(weeks[1].tradeCount, 1);
});

test('cash withdrawals are excluded from profits and weighted by day in Modified Dietz', t => {
  const { store } = fixture(t);
  store.setAnchor('all', { date: '2026-01-09', cash: 300, positions: [{ symbol: 'ABC', shares: 50 }] });
  store.importCsv('drew-individual', csv(['01/07/2026,MoneyLink Transfer,,Withdrawal,,,,-200']), '2026-01-09');
  const week = store.getYear(2026).weeks[1];
  assert.equal(week.total, 850);
  assert.equal(week.externalFlows, -200);
  assert.equal(week.profit, 50);
  assert.ok(Math.abs(week.weekPct - 50 / (1000 - 200 * 2 / 7) * 100) < 1e-9);
  assert.ok(Math.abs(week.ytdPct - week.weekPct) < 1e-9);
});

test('YTD compounds full-precision weekly returns rather than adding percentages', t => {
  const { store } = fixture(t);
  store.setAnchor('all', { date: '2026-01-09', cash: 0, positions: [{ symbol: 'ABC', shares: 100 }] });
  const prices = store.getPrices();
  prices.symbols.ABC.closes['2026-01-02'] = 11;
  prices.symbols.ABC.closes['2026-01-09'] = 9.9;
  store.savePrices(prices);
  const weeks = store.getYear(2026).weeks;
  assert.ok(Math.abs(weeks[0].ytdPct - 10) < 1e-9);
  assert.ok(Math.abs(weeks[1].weekPct + 10) < 1e-9);
  assert.ok(Math.abs(weeks[1].ytdPct + 1) < 1e-9);
  assert.equal(weeks[2].ytdPct, null);
});

test('YTD remains pending after a missing historical period even when weekly returns recover', t => {
  const { store } = fixture(t, '2026-01-17T12:00:00Z');
  for (const account of Object.keys(ACCOUNTS)) store.importCsv(account, csv(['01/01/2026,Bank Interest,,,,,,0']), '2026-01-16');
  const prices = store.getPrices();
  delete prices.symbols.ABC.closes['2026-01-02'];
  prices.symbols.ABC.closes['2026-01-16'] = 12;
  prices.symbols.SPY.closes['2026-01-16'] = 12;
  store.savePrices(prices);
  const weeks = store.getYear(2026).weeks;
  assert.equal(weeks[0].ytdPct, null);
  assert.ok(Number.isFinite(weeks[2].weekPct));
  assert.equal(weeks[2].ytdPct, null);
  assert.equal(store.getYear(2026, 'kaili-roth').weeks[0].ytdPct, null);
});

test('YTD resets at December 31 while the first January weekly return can span December', t => {
  const { store } = fixture(t, '2027-01-09T12:00:00Z');
  for (const account of Object.keys(ACCOUNTS)) store.importCsv(account, csv(['01/01/2026,Bank Interest,,,,,,0']), '2027-01-08');
  store.setAnchor('all', { date: '2027-01-08', cash: 0, positions: [{ symbol: 'ABC', shares: 10 }] });
  const prices = store.getPrices();
  for (const quote of Object.values(prices.symbols)) {
    Object.assign(quote.closes, { '2026-12-25': 10, '2026-12-31': 20, '2027-01-08': 22 });
  }
  store.savePrices(prices);
  const weeks = store.getYear(2027).weeks;
  assert.equal(weeks[0].weekPct, 100);
  assert.equal(weeks[0].ytdPct, 0);
  assert.ok(Math.abs(weeks[1].ytdPct - 10) < 1e-9);
});

test('sweep trades preserve cash equivalents and reinvested income is counted once', () => {
  const rows = parseTransactions(csv([
    '01/02/2026,Buy,SWVXX,Money market,100,1,,-100',
    '01/02/2026,Reinvest Dividend,SWVXX,Income,,,,5',
    '01/02/2026,Reinvest Shares,SWVXX,Money market,5,1,,-5',
  ]), 'drew-roth');
  assert.equal(rows.reduce((n, tx) => n + effect(tx).cash, 0), 5);
  assert.equal(rows.reduce((n, tx) => n + effect(tx).quantity, 0), 0);
  assert.equal(rows.reduce((n, tx) => n + effect(tx).external, 0), 0);
});

test('paired IRA share transfers cancel at portfolio level but remain external account flows', () => {
  const first = parseTransactions(csv(['01/02/2026,Journaled Shares,ABC,Transfer,35,20,,']), 'drew-roth')[0];
  const second = parseTransactions(csv(['01/02/2026,Journaled Shares,ABC,Transfer,-35,20,,']), 'traditional-ira')[0];
  assert.equal(effect(first).external, 700);
  assert.equal(effect(first).external + effect(second).external, 0);
  assert.equal(effect(first).quantity + effect(second).quantity, 0);
});

test('overlapping exports dedupe while preserving legitimate identical fills within each export', t => {
  const { store } = fixture(t);
  const fills = csv(['01/05/2026,Buy,ABC,Example,5,10,0,-50', '01/05/2026,Buy,ABC,Example,5,10,0,-50']);
  assert.equal(store.importCsv('drew-roth', fills, '2026-01-09').added, 2);
  assert.equal(store.importCsv('drew-roth', fills, '2026-01-09').added, 0);
  assert.equal(store.state().transactions.filter(t => t.action === 'Buy').length, 2);
});

test('CSV parser retains effective dates, decimals, quoted commas and escaped quotes', () => {
  const row = parseTransactions(csv(['"01/06/2026 as of 01/05/2026",Buy,ABC,"Example, ""Class A""","1,000.25",10,,-10002.5']), 'drew-roth')[0];
  assert.equal(row.date, '2026-01-05');
  assert.equal(row.description, 'Example, "Class A"');
  assert.equal(row.quantity, 1000.25);
});

test('unknown actions and malformed rows fail without partially importing the export', t => {
  const { store } = fixture(t), count = store.state().transactions.length;
  assert.throws(() => store.importCsv('drew-roth', csv(['01/05/2026,Buy,ABC,Example,5,10,0,-50', '01/05/2026,Unknown,ABC,Example,5,10,0,-50']), '2026-01-09'), /Unsupported/);
  assert.throws(() => parseTransactions(csv(['02/30/2026,Buy,ABC,Example,5,10,0,-50']), 'drew-roth'), /Invalid date/);
  assert.equal(store.state().transactions.length, count);
});

test('missing account anchors and missing prices produce pending values, never fabricated zero returns', t => {
  const { store } = fixture(t);
  assert.equal(store.getYear(2026, 'kaili-roth').weeks[1].total, null);
  const prices = store.getPrices(); delete prices.symbols.ABC.closes['2026-01-09']; store.savePrices(prices);
  const week = store.getYear(2026).weeks[1];
  assert.equal(week.weekPct, null);
  assert.equal(week.total, null);
  assert.match(week.issues.join(' '), /Closing prices unavailable/);
});

test('holiday Fridays use the exchange previous session rather than a missing Friday quote', t => {
  const { store } = fixture(t);
  const prices = store.getPrices();
  for (const p of Object.values(prices.symbols)) { p.closes['2026-01-08'] = 11; delete p.closes['2026-01-09']; }
  store.savePrices(prices);
  assert.equal(store.getYear(2026).weeks[1].holdings[0].closeDate, '2026-01-08');
});

test('stale exchange calendar cannot masquerade as a Friday holiday', t => {
  const { store } = fixture(t);
  const prices = store.getPrices(); prices.symbols.SPY.finalThrough = '2026-01-08';
  store.savePrices(prices);
  assert.equal(store.getYear(2026).weeks[1].total, null);
});

test('split normalization restores historical trade prices and split-aware shares preserve value', t => {
  const { store } = fixture(t);
  const chart = { timestamp: [Date.parse('2026-01-02T14:30Z') / 1000, Date.parse('2026-01-09T14:30Z') / 1000],
    indicators: { quote: [{ close: [50, 55] }] }, events: { splits: { one: { date: Date.parse('2026-01-06T14:30Z') / 1000, numerator: 2, denominator: 1 } } } };
  const normalized = normalizeChart(chart, '2026-01-10');
  assert.equal(normalized.closes['2026-01-02'], 100);
  const prices = store.getPrices(); prices.symbols.ABC = normalized; store.savePrices(prices);
  store.setAnchor('all', { date: '2026-01-09', cash: 0, positions: [{ symbol: 'ABC', shares: 20 }] });
  const weeks = store.getYear(2026).weeks;
  assert.equal(weeks[0].holdings[0].shares, 10);
  assert.equal(weeks[0].total, 1000);
  assert.equal(weeks[1].total, 1100);
  assert.equal(weeks[1].weekPct, 10);
  assert.ok(Math.abs(weeks[1].holdings[0].weekPct - 10) < 1e-10);
});

test('negative reconstructed holdings block totals and return calculation', t => {
  const { store } = fixture(t);
  store.importCsv('drew-roth', csv(['01/05/2026,Buy,ABC,Example,100,10,0,-1000']), '2026-01-09');
  const week = store.getYear(2026).weeks[0];
  assert.equal(week.total, null); assert.equal(week.weekPct, null);
  assert.match(week.issues.join(' '), /negative/);
});

test('capture records fresh after-close holdings but withholds returns beyond transaction coverage', t => {
  const { store } = fixture(t, '2026-01-16T23:30:00Z');
  const live = { stocks: [{ ticker: 'ABC', shares: 20 }], cash: { value: 230 }, stale: false, lastFetchTime: '2026-01-16T23:01:00Z' };
  assert.equal(store.captureLive({ ...live, stale: true }), false);
  assert.equal(store.captureLive({ ...live, lastFetchTime: '2026-01-16T20:00:00Z' }), false);
  assert.equal(store.captureLive(live), true);
  assert.equal(store.captureLive(live), false);
  const week = store.getYear(2026).weeks[2];
  assert.equal(week.source, 'captured'); assert.equal(week.holdings[0].shares, 20);
  assert.equal(week.weekPct, null); assert.match(week.issues.join(' '), /coverage/);
});

test('Friday capture waits until 6 p.m. New York and calendar supports 53 Fridays', t => {
  const { store } = fixture(t, '2026-01-09T22:59:00Z');
  assert.equal(store.getYear(2026).weeks[1].upcoming, true);
  assert.equal(marketTime(new Date('2026-07-03T22:00:00Z')).hour, 18);
  assert.equal(marketTime(new Date('2026-01-09T23:00:00Z')).hour, 18);
  assert.equal(fridays(2027).length, 53);
  assert.equal(fridays(2026).at(-1), '2026-12-25');
});

test('a captured balance that contradicts covered transactions blocks the performance claim', t => {
  const { store } = fixture(t, '2026-01-09T23:30:00Z');
  assert.equal(store.captureLive({ stocks: [{ ticker: 'ABC', shares: 18 }], cash: { value: 450 }, stale: false, lastFetchTime: '2026-01-09T23:00:00Z' }), true);
  const week = store.getYear(2026).weeks[1];
  assert.equal(week.holdings[0].shares, 18);
  assert.equal(week.weekPct, null);
  assert.match(week.issues.join(' '), /Captured balances differ/);
});

test('rebuild persists the real computed snapshot and subsequent reads match', t => {
  const { store, root } = fixture(t); store.rebuild();
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'snapshots', '2026.json')));
  assert.deepEqual(saved.weeks, store.getYear(2026).weeks);
});

test('provider failures preserve previous quote history and remain visible as pending data', async t => {
  const { store } = fixture(t);
  const old = store.getPrices().symbols.ABC;
  const service = createFridayLogService({ store, now: () => new Date('2026-01-10T12:00:00Z'), fetch: async () => ({ ok: false, status: 429 }) });
  const result = await service.refresh();
  assert.deepEqual(store.getPrices().symbols.ABC, old);
  assert.match(result.errors.ABC, /429/);
});

test('Friday scheduler captures and refreshes even if the preceding refresh was late Thursday', async t => {
  const { store } = fixture(t, '2026-01-09T23:30:00Z');
  const prices = store.getPrices(); prices.updatedAt = '2026-01-09T04:00:00Z'; store.savePrices(prices);
  let requests = 0;
  const service = createFridayLogService({ store, now: () => new Date('2026-01-09T23:30:00Z'), fetch: async () => {
    requests++;
    return { ok: true, json: async () => ({ chart: { result: [{ timestamp: [Date.parse('2026-01-09T14:30:00Z') / 1000], indicators: { quote: [{ close: [11] }] } }] } }) };
  } });
  await service.tick({ forceRefresh: async () => ({ stocks: [{ ticker: 'ABC', shares: 15 }], cash: { value: 450 }, stale: false, lastFetchTime: '2026-01-09T23:15:00Z' }) });
  assert.ok(store.state().captures['2026-01-09']);
  assert.equal(requests, 2);
  assert.equal(store.getPrices().symbols.SPY.finalThrough, '2026-01-09');
});

test('private routes deny general accounts, serve family snapshots, and validate imports', async t => {
  const { store } = fixture(t);
  const app = express();
  app.use((req, res, next) => { req.user = { role: req.headers['x-test-role'] || 'general' }; next(); });
  app.use(createFridayLogRoutes({ fridayLogService: { store, refresh: async () => ({}) } }));
  const server = app.listen(0, '127.0.0.1'); t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/friday-log`;
  assert.equal((await fetch(`${url}?year=2026`)).status, 403);
  assert.equal((await fetch(`${url}/refresh`, { method: 'POST' })).status, 403);
  const good = await fetch(`${url}?year=2026`, { headers: { 'x-test-role': 'family' } });
  assert.equal(good.status, 200); assert.equal(good.headers.get('cache-control'), 'no-store');
  assert.equal((await good.json()).weeks.length, 52);
  assert.equal((await fetch(`${url}?year=2026&account=bad`, { headers: { 'x-test-role': 'family' } })).status, 400);
  assert.equal((await fetch(`${url}/import`, { method: 'POST', headers: { 'x-test-role': 'family' } })).status, 400);
  const form = new FormData();
  form.set('account', 'drew-roth'); form.set('through', '2026-01-09');
  form.set('file', new Blob([csv(['01/05/2026,Buy,ABC,Example,5,10,0,-50'])], { type: 'text/csv' }), 'transactions.csv');
  const imported = await fetch(`${url}/import`, { method: 'POST', headers: { 'x-test-role': 'family' }, body: form });
  assert.equal(imported.status, 200); assert.equal((await imported.json()).added, 1);
});
