const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const vm = require('node:vm');
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

test('capture records fresh after-close holdings but withholds returns for mismatched activity', t => {
  const { store } = fixture(t, '2026-01-16T23:30:00Z');
  const live = { stocks: [{ ticker: 'ABC', shares: 20 }], cash: { value: 230 }, stale: false, lastFetchTime: '2026-01-16T23:01:00Z' };
  assert.equal(store.captureLive({ ...live, stale: true }), false);
  assert.equal(store.captureLive({ ...live, lastFetchTime: '2026-01-16T20:00:00Z' }), false);
  assert.equal(store.captureLive(live), true);
  assert.equal(store.captureLive(live), false);
  const week = store.getYear(2026).weeks[2];
  assert.equal(week.source, 'captured'); assert.equal(week.holdings[0].shares, 20);
  assert.equal(week.balancesMatch, false);
  assert.equal(week.weekPct, null); assert.match(week.issues.join(' '), /cash, ABC shares/);
});

test('matching Friday capture confirms returns beyond export coverage without changing coverage', t => {
  const { store } = fixture(t, '2026-01-16T23:30:00Z');
  const prices = store.getPrices();
  prices.symbols.ABC.closes['2026-01-16'] = 12;
  prices.symbols.SPY.closes['2026-01-16'] = 12;
  store.savePrices(prices);
  store.captureLive({ stocks: [{ ticker: 'ABC', shares: 15 }], cash: { value: 450 }, stale: false, lastFetchTime: '2026-01-16T23:01:00Z' });
  const result = store.getYear(2026), week = result.weeks[2];
  assert.equal(result.coverage, '2026-01-09');
  assert.equal(week.balancesMatch, true);
  assert.equal(week.status, 'ready');
  assert.equal(week.total, 630);
  assert.ok(Math.abs(week.weekPct - 15 / 615 * 100) < 1e-9);
  assert.ok(Math.abs(week.ytdPct - 5) < 1e-9);
  assert.deepEqual(week.issues, []);
  assert.equal(store.getYear(2026, 'drew-roth').weeks[2].weekPct, null);
});

test('cash mismatch stays pending until imported activity reconciles with the sheet', t => {
  const { store } = fixture(t, '2026-01-16T23:30:00Z');
  const prices = store.getPrices();
  prices.symbols.ABC.closes['2026-01-16'] = 12;
  prices.symbols.SPY.closes['2026-01-16'] = 12;
  store.savePrices(prices);
  store.captureLive({ stocks: [{ ticker: 'ABC', shares: 15 }], cash: { value: 400 }, stale: false, lastFetchTime: '2026-01-16T23:01:00Z' });
  let week = store.getYear(2026).weeks[2];
  assert.equal(week.balancesMatch, false);
  assert.equal(week.weekPct, null);
  assert.equal(week.ytdPct, null);
  assert.match(week.issues.join(' '), /snapshot: cash/);
  store.importCsv('drew-roth', csv(['01/15/2026,MoneyLink Transfer,,Withdrawal,,,,-50']), '2026-01-16');
  week = store.getYear(2026).weeks[2];
  assert.equal(store.getYear(2026).coverage, '2026-01-09');
  assert.equal(week.balancesMatch, true);
  assert.equal(week.profit, 15);
  assert.ok(Math.abs(week.weekPct - 15 / (615 - 50 / 7) * 100) < 1e-9);
});

test('stale exports without a capture and matching captures without prices remain pending', t => {
  const { store } = fixture(t, '2026-01-16T23:30:00Z');
  let week = store.getYear(2026).weeks[2];
  assert.equal(week.balancesMatch, null);
  assert.equal(week.weekPct, null);
  assert.match(week.issues.join(' '), /No Google Sheet snapshot/);
  store.captureLive({ stocks: [{ ticker: 'ABC', shares: 15 }], cash: { value: 450 }, stale: false, lastFetchTime: '2026-01-16T23:01:00Z' });
  week = store.getYear(2026).weeks[2];
  assert.equal(week.balancesMatch, true);
  assert.equal(week.weekPct, null);
  assert.equal(week.ytdPct, null);
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
  assert.match(week.issues.join(' '), /snapshot: ABC shares/);
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

test('momentum covers traded stocks in weeks they were not held, with trade sides', t => {
  const { store } = fixture(t);
  store.importCsv('drew-roth', csv(['01/05/2026,Buy,XYZ,Example,1,20,0,-20', '01/08/2026,Sell,XYZ,Example,1,22,0,22']), '2026-01-09');
  const prices = store.getPrices();
  prices.symbols.XYZ = { closes: { '2025-12-26': 20, '2026-01-02': 20, '2026-01-09': 25 }, splits: [] };
  store.savePrices(prices);
  const { momentum } = store.getYear(2026);
  assert.deepEqual(momentum.weeks, ['2026-01-02', '2026-01-09']);
  const xyz = momentum.stocks.find(s => s.symbol === 'XYZ'), abc = momentum.stocks.find(s => s.symbol === 'ABC');
  assert.deepEqual(xyz.held, [false, false]);
  assert.deepEqual(xyz.trades, [null, 'BS']);
  assert.equal(xyz.pct[1], 25);
  assert.deepEqual(abc.held, [true, true]);
  assert.ok(Math.abs(abc.pct[1] - 10) < 1e-9);
  assert.ok(Math.abs(momentum.spy[1] - 10) < 1e-9);
});

test('momentum tape sorts by acceleration and hides exited stocks until requested', () => {
  const context = { history: { replaceState() {} } };
  const source = fs.readFileSync(path.join(__dirname, '../public/js/dashboards/fridayLog.js'), 'utf8');
  vm.runInNewContext(source + '\nglobalThis.dashboard = FridayLogDashboard;', context);
  const view = context.dashboard;
  const weeks = Array.from({ length: 9 }, (_, i) => `2026-03-${String(6 + i).padStart(2, '0')}`);
  const flat = Array(9).fill(1), on = Array(9).fill(true);
  view.account = 'all';
  view.data = { accounts: {}, momentum: { weeks, portfolio: flat, spy: flat, stocks: [
    { symbol: 'FADE', pct: [0, 9, 9, 9, 9, -2, -2, -2, -2], held: on, weight: Array(9).fill(5), trades: Array(9).fill(null) },
    { symbol: 'FAST', pct: [0, -2, -2, -2, -2, 9, 9, 9, 9], held: on, weight: Array(9).fill(5), trades: [null, 'B', ...Array(7).fill(null)] },
    { symbol: 'GONE', pct: flat, held: [true, ...Array(8).fill(false)], weight: [3, ...Array(8).fill(null)], trades: Array(9).fill(null) },
  ] } };
  let html = view.momentumHtml();
  assert.ok(html.indexOf('>FAST<') < html.indexOf('>FADE<'));
  assert.match(html, /fl-acc/); assert.match(html, /fl-fade/); assert.match(html, /▲/);
  assert.doesNotMatch(html, />GONE</);
  view.momentumAll = true; html = view.momentumHtml();
  assert.match(html, />GONE</);
  view.root = { innerHTML: '' }; view.view = 'momentum'; view.year = 2026;
  Object.assign(view.data, { year: 2026, years: [2026], account: 'all' });
  view.draw();
  assert.match(view.root.innerHTML, /data-view="momentum" aria-selected="true"/);
  assert.match(view.root.innerHTML, /class="fl-momentum"/);
  view.data.momentum.weeks = weeks.slice(0, 4);
  assert.equal(view.momentumHtml(), '');
});

test('Fridays view no longer carries the momentum tape', t => {
  const { store } = fixture(t);
  const context = { history: { replaceState() {} } };
  const source = fs.readFileSync(path.join(__dirname, '../public/js/dashboards/fridayLog.js'), 'utf8');
  vm.runInNewContext(source + '\nglobalThis.dashboard = FridayLogDashboard;', context);
  const view = context.dashboard;
  view.root = { innerHTML: '' }; view.year = 2026; view.account = 'all'; view.selected = '2026-01-09';
  view.data = { ...store.getYear(2026), canManage: false };
  view.draw();
  assert.match(view.root.innerHTML, /data-view="momentum"/);
  assert.doesNotMatch(view.root.innerHTML, /class="fl-momentum"/);
});

test('Friday view omits management controls for readers and retains them for family users', t => {
  const { store } = fixture(t);
  const context = { history: { replaceState() {} } };
  const source = fs.readFileSync(path.join(__dirname, '../public/js/dashboards/fridayLog.js'), 'utf8');
  vm.runInNewContext(source + '\nglobalThis.dashboard = FridayLogDashboard;', context);
  const view = context.dashboard;
  view.root = { innerHTML: '' }; view.year = 2026; view.account = 'all'; view.selected = '2026-01-09';
  view.data = { ...store.getYear(2026), canManage: false };
  view.draw();
  assert.match(view.root.innerHTML, /PORTFOLIO YTD/);
  assert.doesNotMatch(view.root.innerHTML, /class="fl-import"|data-action="refresh"/);
  view.data.canManage = true; view.draw();
  assert.match(view.root.innerHTML, /class="fl-import"/);
  assert.match(view.root.innerHTML, /data-action="refresh"/);
});

test('signed-in users can read snapshots; only family users can import or refresh', async t => {
  const { store } = fixture(t);
  const app = express();
  app.use((req, res, next) => { if (req.headers['x-test-role'] !== 'anonymous') req.user = { role: req.headers['x-test-role'] || 'general' }; next(); });
  app.use(createFridayLogRoutes({ fridayLogService: { store, refresh: async () => ({}) } }));
  const server = app.listen(0, '127.0.0.1'); t.after(() => server.close());
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/friday-log`;
  assert.equal((await fetch(`${url}?year=2026`, { headers: { 'x-test-role': 'anonymous' } })).status, 401);
  const general = await fetch(`${url}?year=2026`);
  assert.equal(general.status, 200);
  const generalData = await general.json();
  assert.equal(generalData.canManage, false);
  assert.equal(generalData.weeks.length, 52);
  assert.equal((await fetch(`${url}?year=2026&account=drew-roth`)).status, 200);
  const trades = await fetch(`${url}/trades?account=drew-roth`);
  assert.equal(trades.status, 200); assert.equal((await trades.json()).account, 'drew-roth');
  assert.equal((await fetch(`${url}/trades?account=bad`)).status, 400);
  assert.equal((await fetch(`${url}/refresh`, { method: 'POST' })).status, 403);
  assert.equal((await fetch(`${url}/import`, { method: 'POST' })).status, 403);
  const good = await fetch(`${url}?year=2026`, { headers: { 'x-test-role': 'family' } });
  assert.equal(good.status, 200); assert.equal(good.headers.get('cache-control'), 'no-store');
  const familyData = await good.json();
  assert.equal(familyData.weeks.length, 52);
  assert.equal(familyData.canManage, true);
  assert.equal((await fetch(`${url}/refresh`, { method: 'POST', headers: { 'x-test-role': 'family' } })).status, 200);
  assert.equal((await fetch(`${url}?year=2026&account=bad`, { headers: { 'x-test-role': 'family' } })).status, 400);
  assert.equal((await fetch(`${url}/import`, { method: 'POST', headers: { 'x-test-role': 'family' } })).status, 400);
  const form = new FormData();
  form.set('account', 'drew-roth'); form.set('through', '2026-01-09');
  form.set('file', new Blob([csv(['01/05/2026,Buy,ABC,Example,5,10,0,-50'])], { type: 'text/csv' }), 'transactions.csv');
  const imported = await fetch(`${url}/import`, { method: 'POST', headers: { 'x-test-role': 'family' }, body: form });
  assert.equal(imported.status, 200); assert.equal((await imported.json()).added, 1);
});

test('trade statistics match FIFO lots, seed Dec 31 holdings, and split open lots', t => {
  const { store } = fixture(t, '2026-03-10T12:00:00Z');
  store.importCsv('drew-roth', csv([
    '01/05/2026,Buy,XYZ,Example,10,20,0,-200',
    '01/20/2026,Buy,XYZ,Example,10,30,0,-300',
    '02/02/2026,Sell,XYZ,Example,15,40,1,599',
    '02/10/2026,Qualified Dividend,XYZ,Example,,,,12',
    '02/20/2026,Sell,ABC,Example,5,9,0,45',
  ]), '2026-03-06');
  store.setAnchor('all', { date: '2026-03-06', cash: 1000, positions: [{ symbol: 'ABC', shares: 10 }, { symbol: 'XYZ', shares: 10 }], source: 'Test reference' });
  const closes = { '2025-12-31': 10, '2026-03-06': 12 };
  store.savePrices({ symbols: { ABC: { closes, splits: [] }, XYZ: { closes: { '2025-12-31': 20, '2026-03-06': 25 }, splits: [{ date: '2026-02-15', ratio: 2 }] }, SPY: { closes, splits: [] } }, updatedAt: null, errors: {} });
  const all = store.getTrades('all');
  const xyz = all.symbols.find(s => s.symbol === 'XYZ'), abc = all.symbols.find(s => s.symbol === 'ABC');
  // 15 shares sold: 10 at $20 cost and 5 at $30 cost against $599 net proceeds.
  assert.equal(xyz.sells, 1); assert.equal(xyz.realized, 249); assert.equal(xyz.sellEvents[0].days, 23);
  assert.equal(xyz.roundTrips.length, 2); assert.equal(xyz.roundTrips[1].buyDate, '2026-01-20');
  // The remaining 5 shares at $30 doubled into 10 shares at $15 on the split.
  assert.equal(xyz.openShares, 10); assert.equal(xyz.avgCost, 15); assert.equal(xyz.unrealized, 100);
  assert.equal(xyz.dividends, 12);
  // Shares held on December 31 are priced at that close, and a ledger seeded from the anchor never goes negative.
  assert.equal(abc.openingShares, 15); assert.equal(abc.realized, -5); assert.equal(abc.sellEvents[0].opening, true);
  assert.equal(abc.openShares, 10); assert.equal(abc.unrealized, 20);
  // Neither position is fully sold yet, so nothing is a win or a loss.
  assert.equal(all.overall.wins, 0); assert.equal(all.overall.losses, 0); assert.equal(all.overall.winRate, null); assert.equal(all.overall.positions, 0);
  assert.equal(all.overall.realized, 244); assert.equal(all.overall.fees, 1);
  // Average buy is the cost of the shares sold; rankings use percentages and only fully sold positions rank as stocks.
  assert.equal(xyz.avgBuyPrice, 23.33333333); assert.equal(xyz.avgSellPrice, 39.93333333); assert.equal(abc.avgBuyPrice, 10); assert.equal(abc.avgSellPrice, 9);
  assert.equal(all.overall.bestClosed, null); assert.equal(all.overall.bestOpen.symbol, 'XYZ'); assert.equal(all.overall.worstOpen.symbol, 'ABC');
  assert.equal(all.byMonth.map(m => m.key).join(), '2026-01,2026-02');
  assert.equal(all.byAccount.find(a => a.key === 'drew-roth').realized, 244);
  // A single account has no balance reference; excess sells fall back to the Dec 31 close.
  const roth = store.getTrades('drew-roth');
  assert.equal(roth.symbols.find(s => s.symbol === 'ABC').realized, -5);
  assert.equal(roth.byAccount.length, 0);
  assert.throws(() => store.getTrades('bad'), /Unknown account/);
});

test('journaled shares move a lot between accounts without counting as a trade', t => {
  const { store } = fixture(t, '2026-03-10T12:00:00Z');
  store.importCsv('drew-roth', csv(['01/05/2026,Buy,XYZ,Example,10,20,0,-200', '02/01/2026,Journaled Shares,XYZ,Example,-10,22,,']), '2026-03-06');
  store.importCsv('kaili-roth', csv(['02/01/2026,Journaled Shares,XYZ,Example,10,22,,', '02/20/2026,Sell,XYZ,Example,10,30,0,300']), '2026-03-06');
  store.savePrices({ symbols: { XYZ: { closes: { '2025-12-31': 20 }, splits: [] }, SPY: { closes: { '2025-12-31': 10 }, splits: [] } }, updatedAt: null, errors: {} });
  const all = store.getTrades('all').symbols.find(s => s.symbol === 'XYZ');
  assert.equal(all.buys, 1); assert.equal(all.sells, 1); assert.equal(all.realized, 100); assert.equal(all.openShares, 0);
  assert.equal(store.getTrades('drew-roth').symbols.find(s => s.symbol === 'XYZ').sells, 0);
  const kaili = store.getTrades('kaili-roth').symbols.find(s => s.symbol === 'XYZ');
  assert.equal(kaili.realized, 80); assert.equal(kaili.roundTrips[0].transfer, true);
});

test('trades view renders statistics, filters the stock table, and shows a single ticker', t => {
  const { store } = fixture(t, '2026-03-10T12:00:00Z');
  store.importCsv('drew-roth', csv(['01/05/2026,Buy,XYZ,Example Corp,10,20,0,-200', '02/02/2026,Sell,XYZ,Example Corp,10,40,0,400']), '2026-03-06');
  const context = { history: { replaceState() {} }, window: { scrollTo() {} } };
  const source = fs.readFileSync(path.join(__dirname, '../public/js/dashboards/fridayLog.js'), 'utf8');
  vm.runInNewContext(source + '\nglobalThis.dashboard = FridayLogDashboard;', context);
  const view = context.dashboard;
  view.root = { innerHTML: '', querySelector: () => null }; view.view = 'trades'; view.account = 'all';
  view.trades = store.getTrades('all'); view.draw();
  assert.match(view.root.innerHTML, /REALIZED GAIN/); assert.match(view.root.innerHTML, /data-lookup-symbol="XYZ"/);
  assert.match(view.root.innerHTML, /aria-selected="true">Trades/);
  view.query = 'nothing'; assert.match(view.symbolRowsHtml(), /No traded stock matches/);
  view.query = 'example'; assert.match(view.symbolRowsHtml(), /XYZ/);
  view.select('XYZ');
  assert.match(view.root.innerHTML, /AVERAGE BUY/); assert.match(view.root.innerHTML, /AVERAGE SELL/); assert.doesNotMatch(view.root.innerHTML, /SINGLE SELLS/);
  assert.match(view.root.innerHTML, /\+\$200/);
});

test('older history parses options, rollovers, wires, split rows and same-account journal pairs', t => {
  const { store } = fixture(t, '2026-03-10T12:00:00Z');
  store.importCsv('drew-roth', csv([
    '11/14/2022,Sell,MDB,Mongo,10,100,0.10,999.90',
    '07/26/2024,Funds Received,,IRA ROLLOVER CONT,,,,90000',
    '10/04/2024,Buy to Open,SMCI 08/15/2025 50.00 C,CALL SUPER MICRO,5,9.13,3.30,-4568.30',
    '11/08/2024,Sell to Close,SMCI 08/15/2025 50.00 C,CALL SUPER MICRO,5,2.23,3.35,1111.65',
    '10/01/2024,Stock Split,SMCI,SUPER MICRO COMPUTER INC,220,,,',
    '10/01/2024,Stock Split Adj,86800U104,SUPER MICRO COMPUTER INCFORWARD SPLIT WITH STOCK SPLIT SHARES,-22,,,',
    '10/08/2024,Journal,APP,APPLOVIN,-160,,,',
    '10/08/2024,Journal,APP,APPLOVIN,160,,,',
    '10/19/2023,Wire Sent,,FX WIRE OUT,,,,-5969.73',
    '10/19/2023,Service Fee,,WIRED FUNDS FEE,,,,-25',
    '10/19/2023,Misc Cash Entry,,WAIVE WIRE FEE,,,,25',
    '11/27/2024,Margin Interest,,INTEREST,,,,-14.15',
    '01/05/2025,Buy,APP,APPLOVIN,10,300,0,-3000',
    '01/20/2026,Sell,APP,APPLOVIN,4,400,0,1600',
    '02/20/2026,Sell,APP,APPLOVIN,6,400,0,2400',
  ]), '2026-03-06');
  const records = store.state().transactions.filter(t => t.account === 'drew-roth');
  assert.equal(records.find(t => t.action === 'Stock Split Adj').symbol, 'SMCI');
  // Split rows never change reconstructed share counts; the price cache's split does that.
  assert.equal(effect(records.find(t => t.action === 'Stock Split')).quantity, 0);
  assert.equal(effect(records.find(t => t.action === 'Funds Received')).external, 90000);
  assert.equal(effect(records.find(t => t.action === 'Wire Sent')).external, -5969.73);
  assert.equal(effect(records.find(t => t.action === 'Sell to Close')).quantity, -5);
  store.savePrices({ symbols: { MDB: { closes: { '2022-11-11': 90, '2025-12-31': 150 }, splits: [] }, APP: { closes: { '2025-12-31': 350, '2026-03-06': 380 }, splits: [] }, SPY: { closes: { '2022-11-11': 10, '2025-12-31': 10 }, splits: [] } }, updatedAt: null, errors: {} });
  const all = store.getTrades('drew-roth', { from: '2022-01-01' });
  assert.equal(all.openingDate, '2022-11-13');
  // A sale before any recorded purchase is priced at the ledger's first close (the prior session).
  const mdb = all.symbols.find(s => s.symbol === 'MDB');
  assert.equal(mdb.openingShares, 10); assert.equal(mdb.realized, 99.9); assert.equal(mdb.sellEvents[0].opening, true);
  // Option contracts count as 100 shares so the average prices match the quoted premiums.
  const call = all.symbols.find(s => s.option);
  assert.equal(call.symbol, 'SMCI 08/15/2025 50.00 C'); assert.equal(call.realized, -3456.65);
  assert.equal(call.avgBuyPrice, 9.1366); assert.equal(call.avgSellPrice, 2.2233); assert.equal(call.status, 'closed');
  // Same-day, same-account journals that net to zero neither open nor close a lot.
  const app = all.symbols.find(s => s.symbol === 'APP');
  assert.equal(app.buys, 1); assert.equal(app.realized, 1000); assert.equal(app.roundTrips.length, 2); assert.equal(app.roundTrips[0].transfer, false);
  // A trim and the final exit are one position: one win, held from the first buy to the last sell.
  assert.equal(app.sells, 2); assert.equal(app.wins, 1); assert.equal(app.positions.length, 1); assert.equal(app.positions[0].days, 411);
  assert.equal(app.positions[0].gainPct, 33.33333333);
  assert.equal(all.overall.positions, 3); assert.equal(all.overall.wins, 2); assert.equal(all.overall.losses, 1); assert.equal(all.overall.avgHoldDays, Math.round((411 + 35 + 1) / 3));
  assert.equal(all.overall.deposits, 90000); assert.equal(all.overall.withdrawals, 5969.73); assert.equal(all.overall.fees, 20.9);
  assert.equal(all.overall.worstClosed.symbol, 'SMCI 08/15/2025 50.00 C');
  // Stocks and option contracts can be reported apart, and together they break down by type.
  assert.equal(all.byType.map(b => `${b.key}:${b.sells}:${b.wins}`).join(), 'options:1:0,stocks:3:2');
  const stocks = store.getTrades('drew-roth', { from: '2022-01-01', type: 'stocks' });
  assert.equal(stocks.symbols.some(s => s.option), false); assert.equal(stocks.overall.realized, 1099.9); assert.equal(stocks.overall.fees, 14.25);
  const options = store.getTrades('drew-roth', { from: '2022-01-01', type: 'options' });
  assert.equal(options.symbols.map(s => s.symbol).join(), 'SMCI 08/15/2025 50.00 C'); assert.equal(options.overall.deposits, 90000);
  assert.throws(() => store.getTrades('drew-roth', { type: 'bonds' }), /stocks, options or all/);
  // A period reports only its own sells while lots keep their real purchase cost from earlier years.
  const ytd = store.getTrades('drew-roth');
  assert.equal(ytd.from, '2026-01-01'); assert.equal(ytd.to, '2026-03-10');
  assert.equal(ytd.symbols.map(s => s.symbol).join(), 'APP'); assert.equal(ytd.symbols[0].realized, 1000); assert.equal(ytd.symbols[0].buys, 0); assert.equal(ytd.overall.wins, 1);
  assert.equal(ytd.overall.deposits, 0);
  const y2024 = store.getTrades('drew-roth', { from: '2024-01-01', to: '2024-12-31' });
  assert.equal(y2024.to, '2024-12-31'); assert.equal(y2024.overall.sells, 1); assert.equal(y2024.overall.realized, -3456.65);
  assert.equal(y2024.symbols.some(s => s.symbol === 'APP'), false);
  assert.throws(() => store.getTrades('drew-roth', { from: '2025-01-01', to: '2024-12-31' }), /period start/);
});

test('combined trade history unwinds the balance reference to the first ledger day', t => {
  const { store } = fixture(t, '2026-03-10T12:00:00Z');
  store.importCsv('drew-roth', csv(['06/01/2024,Sell,ABC,Example,5,12,0,60', '02/01/2026,Buy,ABC,Example,5,11,0,-55']), '2026-03-06');
  store.setAnchor('all', { date: '2026-03-06', cash: 1000, positions: [{ symbol: 'ABC', shares: 20 }], source: 'Test reference' });
  const closes = { '2024-05-31': 8, '2025-12-31': 10, '2026-03-06': 12 };
  store.savePrices({ symbols: { ABC: { closes, splits: [] }, SPY: { closes, splits: [] } }, updatedAt: null, errors: {} });
  const all = store.getTrades('all', { from: '2024-01-01' });
  const abc = all.symbols.find(s => s.symbol === 'ABC');
  // 20 held now minus 5 bought plus 5 sold means 20 were held on the first day, priced at $8.
  assert.equal(all.openingDate, '2024-05-31'); assert.equal(abc.openingShares, 20); assert.equal(abc.realized, 20);
  assert.equal(abc.openShares, 20); assert.equal(abc.openCost, 15 * 8 + 55); assert.equal(abc.avgBuyPrice, 8);
  assert.equal(all.ledgerStart, '2024-06-01');
});

test('price refresh starts before the first ledger day, skips option symbols and dormant history', async t => {
  const { store } = fixture(t, '2026-01-10T12:00:00Z');
  store.importCsv('drew-roth', csv(['03/03/2023,Sell,OLD,Old,1,10,0,10', '01/05/2026,Buy,XYZ,Example,1,20,0,-20', '01/05/2026,Buy to Open,XYZ 06/19/2026 20.00 C,Call,1,1,0,-100']), '2026-01-09');
  const urls = [];
  const fetch = async url => {
    urls.push(url);
    return { ok: true, json: async () => ({ chart: { result: [{ timestamp: [1767225600], indicators: { quote: [{ close: [5] }] }, events: {} }] } }) };
  };
  const service = createFridayLogService({ store, fetch, now: () => new Date('2026-01-10T12:00:00Z') });
  await service.refresh();
  const requested = () => urls.map(u => decodeURIComponent(u.split('/chart/')[1].split('?')[0])).sort();
  assert.deepEqual(requested(), ['ABC', 'OLD', 'SPY', 'XYZ']);
  assert.equal(new URL(urls[0]).searchParams.get('period1'), String(Date.parse('2023-02-21T00:00:00Z') / 1000));
  assert.equal(store.getPrices().symbols.OLD.from, '2023-02-21');
  urls.length = 0; await service.refresh();
  // OLD was last traded before the standard quote window and already has history back far enough.
  assert.deepEqual(requested(), ['ABC', 'SPY', 'XYZ']);
});
