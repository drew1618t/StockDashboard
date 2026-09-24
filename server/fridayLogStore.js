const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNTS = {
  'drew-roth': 'Drew Roth', 'kaili-roth': 'Kaili Roth',
  'traditional-ira': 'Traditional IRA', 'drew-individual': 'Drew Individual',
};
const START = '2025-12-31';
const DAY = 86400000;
const CASH_SYMBOLS = new Set(['SWVXX']);
const ACTIONS = new Set(['Buy', 'Sell', 'Reinvest Shares', 'Reinvest Dividend', 'Qualified Dividend',
  'Cash Dividend', 'Bank Interest', 'Credit Interest', 'ADR Mgmt Fee', 'Journal', 'Journaled Shares',
  'MoneyLink Transfer']);

/** Round calculation noise without discarding fractional shares. */
function clean(n) { return Math.round(n * 1e8) / 1e8; }

/** Shift an ISO date without depending on the server's timezone. */
function shift(date, days) { return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10); }

/** Validate actual ISO calendar dates before using them for coverage or filenames. */
function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && shift(date, 0) === date;
}

/** Return the exchange-local date and hour, including daylight-saving transitions. */
function marketTime(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** Parse RFC-style CSV fields, including quoted commas, escaped quotes, and line breaks. */
function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  const input = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, '')); field = '';
      if (c === '\n') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed quote in CSV');
  row.push(field.replace(/\r$/, '')); if (row.some(Boolean)) rows.push(row);
  return rows;
}

/** Read Schwab numeric fields strictly; blank fields remain distinguishable from zero. */
function number(raw) {
  if (!raw || !raw.trim()) return null;
  const value = Number(raw.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1'));
  if (!Number.isFinite(value)) throw new Error(`Invalid numeric field: ${raw}`);
  return value;
}

/** Normalize all cash and security activity, using Schwab's effective 'as of' date. */
function parseTransactions(text, account) {
  if (!ACCOUNTS[account]) throw new Error('Choose a valid account');
  const [header, ...rows] = parseCsv(text);
  if (!header || !['Date', 'Action', 'Symbol', 'Quantity', 'Price', 'Amount'].every(h => header.includes(h))) {
    throw new Error('Expected a Schwab transaction CSV with Date, Action, Symbol, Quantity, Price and Amount');
  }
  const occurrences = new Map();
  return rows.map((cols, index) => {
    const row = Object.fromEntries(header.map((h, i) => [h, cols[i] || '']));
    const dateText = row.Date.split(' as of ').pop();
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
    const date = match ? `${match[3]}-${match[1]}-${match[2]}` : '';
    if (!validDate(date)) throw new Error(`Invalid date on CSV row ${index + 2}`);
    if (!ACTIONS.has(row.Action)) throw new Error(`Unsupported activity '${row.Action}' on ${date}; review before importing`);
    const tx = { account, date, postedDate: row.Date.split(' as of ')[0], action: row.Action,
      symbol: row.Symbol.trim().toUpperCase(), description: row.Description || '',
      quantity: number(row.Quantity), price: number(row.Price), amount: number(row.Amount),
      fees: number(row['Fees & Comm']) || 0 };
    if (['Buy', 'Sell', 'Reinvest Shares', 'Journaled Shares'].includes(tx.action)
      && (!tx.symbol || tx.quantity === null)) throw new Error(`Missing security quantity on ${date}`);
    if (['Buy', 'Sell', 'Reinvest Shares'].includes(tx.action) && (tx.amount === null || tx.quantity <= 0)) {
      throw new Error(`Missing amount or invalid trade quantity on ${date}`);
    }
    // Multiplicity preserves two identical fills in one export while overlapping exports deduplicate.
    const key = JSON.stringify([account, date, tx.action, tx.symbol, tx.quantity, tx.price, tx.amount, tx.fees]);
    const count = (occurrences.get(key) || 0) + 1; occurrences.set(key, count);
    tx.id = crypto.createHash('sha256').update(`${key}:${count}`).digest('hex').slice(0, 24);
    return tx;
  });
}

/** Translate a record into changes to shares, cash equivalents, and external capital. */
function effect(tx) {
  const security = ['Buy', 'Sell', 'Reinvest Shares', 'Journaled Shares', 'Journal'].includes(tx.action);
  const quantity = security ? (tx.quantity || 0) * (tx.action === 'Sell' ? -1 : 1) : 0;
  const sweep = CASH_SYMBOLS.has(tx.symbol);
  const cash = (tx.amount || 0) + (sweep ? quantity : 0);
  const journal = ['Journaled Shares', 'Journal'].includes(tx.action);
  const external = tx.action === 'MoneyLink Transfer' ? cash
    : journal ? (sweep ? quantity : quantity * (tx.price || 0)) + (tx.amount || 0) : 0;
  return { quantity: sweep ? 0 : quantity, cash, external,
    unknownFlow: journal && !sweep && quantity !== 0 && tx.price === null };
}

/** Keep all 52 or 53 Fridays in the selected calendar year. */
function fridays(year) {
  let date = `${year}-01-01`;
  while (new Date(`${date}T00:00:00Z`).getUTCDay() !== 5) date = shift(date, 1);
  const dates = [];
  while (date.startsWith(String(year))) { dates.push(date); date = shift(date, 7); }
  return dates;
}

/** Read a persisted document; corrupt data must not silently turn into an empty ledger. */
function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

/** Replace a private runtime document atomically so interrupted writes preserve the prior version. */
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temp, file);
}

/** Create an isolated store usable by the application, importer, and deterministic tests. */
function createFridayLogStore(options = {}) {
  const root = options.root || process.env.FRIDAY_LOG_DIR || path.join(__dirname, '..', 'data', 'friday-log');
  const clock = options.now || (() => new Date());
  const statePath = path.join(root, 'ledger.json'), pricesPath = path.join(root, 'prices.json');

  /** Load account coverage, immutable source metadata, anchors and captured Fridays. */
  function state() { return readJson(statePath, { version: 1, transactions: [], imports: [], coverage: {}, anchors: {}, captures: {} }); }

  /** Import an overlapping export without losing identical fills or shortening source coverage. */
  function importCsv(account, csv, through, source = 'Schwab export') {
    if (!validDate(through) || through > marketTime(clock()).date) throw new Error('Export date must be a valid date no later than today');
    const records = parseTransactions(csv, account);
    if (!records.length) throw new Error('The CSV contains no transactions');
    if (records.some(t => t.date > through)) throw new Error('Export date precedes a transaction in this file');
    const data = state(), seen = new Set(data.transactions.map(t => t.id));
    const added = records.filter(t => !seen.has(t.id));
    data.transactions.push(...added);
    data.transactions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    data.coverage[account] = [data.coverage[account] || '', through].sort().pop();
    const hash = crypto.createHash('sha256').update(csv).digest('hex');
    if (!data.imports.some(i => i.hash === hash && i.account === account)) {
      data.imports.push({ account, through, source: path.basename(source), hash, rows: records.length });
      fs.mkdirSync(path.join(root, 'imports'), { recursive: true });
      fs.writeFileSync(path.join(root, 'imports', `${account}-${hash.slice(0, 16)}.csv`), csv);
    }
    writeJson(statePath, data);
    return { added: added.length, total: data.transactions.length, coverage: data.coverage[account] };
  }

  /** Save a dated, complete balance reference; cash includes sweep money-market funds. */
  function setAnchor(account, anchor) {
    if (account !== 'all' && !ACCOUNTS[account]) throw new Error('Unknown account');
    if (!validDate(anchor.date) || anchor.date < START || anchor.date > marketTime(clock()).date
      || !Number.isFinite(anchor.cash) || !Array.isArray(anchor.positions)
      || anchor.positions.some(p => !/^[A-Z0-9.^=-]+$/.test(p.symbol) || !Number.isFinite(p.shares) || p.shares < 0)) {
      throw new Error('A dated cash balance and complete nonnegative share quantities are required');
    }
    if (anchor.positions.some(p => CASH_SYMBOLS.has(p.symbol))) throw new Error('Include SWVXX in cash equivalents, not equities');
    if (new Set(anchor.positions.map(p => p.symbol)).size !== anchor.positions.length) throw new Error('Duplicate anchor ticker');
    const data = state(); data.anchors[account] = anchor; writeJson(statePath, data);
  }

  /** Save a fresh after-close combined balance, without assuming unimported trades did not occur. */
  function captureLive(live) {
    const now = marketTime(clock()), fetched = live && live.lastFetchTime && new Date(live.lastFetchTime);
    if (!live || live.stale || !fetched || !Number.isFinite(+fetched) || live.stocks?.length === 0
      || !live.stocks || !Number.isFinite(live.cash?.value) || now.hour < 18
      || new Date(`${now.date}T00:00:00Z`).getUTCDay() !== 5
      || marketTime(fetched).date !== now.date || marketTime(fetched).hour < 16
      || +clock() - +fetched > 2 * 60 * 60 * 1000 || +fetched > +clock()) return false;
    if (live.stocks.some(s => !Number.isFinite(s.shares) || s.shares < 0)) return false;
    const data = state();
    if (data.captures[now.date]) return false;
    data.captures[now.date] = { date: now.date, cash: live.cash.value,
      positions: live.stocks.map(s => ({ symbol: s.ticker, shares: s.shares })),
      source: 'Google Sheets after-close holdings', capturedAt: live.lastFetchTime };
    writeJson(statePath, data); return true;
  }

  /** Read normalized historical prices and corporate actions. */
  function getPrices() { return readJson(pricesPath, { symbols: {}, updatedAt: null, errors: {} }); }

  /** Persist downloaded quotes separately from the user's original transaction records. */
  function savePrices(prices) { writeJson(pricesPath, prices); }

  /** Find the last actual exchange session, never substituting a stale quote for a missing close. */
  function closeAt(prices, symbol, date) {
    // A stale market calendar must not make a missing Friday look like an exchange holiday.
    if (prices.symbols.SPY?.finalThrough && prices.symbols.SPY.finalThrough < date) return null;
    const sessions = Object.keys(prices.symbols.SPY?.closes || {}).filter(d => d <= date && d >= shift(date, -6)).sort();
    const session = sessions.at(-1);
    if (session && prices.symbols[symbol]?.finalThrough && prices.symbols[symbol].finalThrough < session) return null;
    const value = session && prices.symbols[symbol]?.closes?.[session];
    return Number.isFinite(value) && value > 0 ? { price: value, date: session } : null;
  }

  /** Reconstruct dated balances by undoing or replaying trades and share splits around the anchor. */
  function balanceAt(anchor, date, transactions, prices) {
    if (!anchor) return null;
    const shares = Object.fromEntries(anchor.positions.map(p => [p.symbol, p.shares]));
    let cash = anchor.cash;
    const forward = date >= anchor.date, low = forward ? anchor.date : date, high = forward ? date : anchor.date;
    const events = transactions.filter(t => t.date > low && t.date <= high).map(t => ({ date: t.date, tx: t }));
    for (const [symbol, quote] of Object.entries(prices.symbols)) {
      for (const split of quote.splits || []) {
        if (split.date > low && split.date <= high) events.push({ ...split, symbol });
      }
    }
    // Splits take effect before trading on their ex-date. Reverse the full event order when undoing.
    events.sort((a, b) => a.date.localeCompare(b.date) || Number(!!a.tx) - Number(!!b.tx));
    if (!forward) events.reverse();
    for (const event of events) {
      if (!event.tx) { shares[event.symbol] = (shares[event.symbol] || 0) * (forward ? event.ratio : 1 / event.ratio); continue; }
      const delta = effect(event.tx), direction = forward ? 1 : -1;
      if (delta.quantity) shares[event.tx.symbol] = (shares[event.tx.symbol] || 0) + direction * delta.quantity;
      cash += direction * delta.cash;
    }
    return { cash: clean(cash), positions: Object.entries(shares).map(([symbol, count]) => ({ symbol, shares: clean(count) })).filter(p => Math.abs(p.shares) > 1e-6) };
  }

  /** Build the selected year's calendar, preserving missing-data states instead of zero returns. */
  function getYear(year, account = 'all') {
    if (!Number.isInteger(year) || year < 2026 || year > Number(marketTime(clock()).date.slice(0, 4))) throw new Error('Invalid year');
    if (account !== 'all' && !ACCOUNTS[account]) throw new Error('Unknown account');
    const data = state(), prices = getPrices(), now = marketTime(clock());
    const transactions = data.transactions.filter(t => account === 'all' || t.account === account);
    const anchor = data.anchors[account];
    const coverage = account === 'all'
      ? Object.keys(ACCOUNTS).map(a => data.coverage[a] || '').sort()[0] : data.coverage[account] || '';
    const names = Object.fromEntries(transactions.filter(t => t.symbol).map(t => [t.symbol, t.description]));
    const dates = fridays(year);
    const weeks = dates.map(date => {
      const periodStart = shift(date, -7) < START ? START : shift(date, -7);
      const activity = transactions.filter(t => t.date > periodStart && t.date <= date);
      const upcoming = date > now.date || (date === now.date && now.hour < 18);
      const covered = coverage >= date && coverage >= (anchor?.date || date);
      const captured = account === 'all' ? data.captures[date] : null;
      const reconstructed = covered ? balanceAt(anchor, date, transactions, prices) : null;
      const balance = upcoming ? null : captured || reconstructed;
      const previous = covered ? balanceAt(anchor, periodStart, transactions, prices) : null;
      const issues = [];
      if (!upcoming && !anchor) issues.push('Add this account’s dated holdings and cash to reconstruct its history.');
      if (!upcoming && !covered) issues.push(`Transaction coverage ${coverage ? `ends ${coverage}` : 'is missing'}. Import all accounts through this Friday to calculate returns.`);
      // A live capture can reveal an unrecorded trade or cash movement even after files claim coverage.
      const capturedMap = new Map((captured?.positions || []).map(p => [p.symbol, p.shares]));
      const reconstructedMap = new Map((reconstructed?.positions || []).map(p => [p.symbol, p.shares]));
      const captureMismatch = !!(captured && reconstructed && (Math.abs(captured.cash - reconstructed.cash) > 0.01
        || [...new Set([...capturedMap.keys(), ...reconstructedMap.keys()])].some(symbol => Math.abs((capturedMap.get(symbol) || 0) - (reconstructedMap.get(symbol) || 0)) > 1e-6)));
      if (captureMismatch) issues.push('Captured balances differ from the transaction reconstruction. Reconcile holdings and cash before using the return.');
      const negative = balance?.positions.some(p => p.shares < 0) || previous?.positions.some(p => p.shares < 0);
      if (negative) issues.push('Reconstructed shares are negative. Reconcile the balance reference, transfers or corporate actions.');
      const holdings = (balance?.positions || []).map(p => {
        const close = closeAt(prices, p.symbol, date), prior = closeAt(prices, p.symbol, shift(date, -7));
        const splitFactor = (prices.symbols[p.symbol]?.splits || []).filter(s => s.date > (prior?.date || date) && s.date <= (close?.date || date)).reduce((n, s) => n * s.ratio, 1);
        return { ...p, name: names[p.symbol] || p.symbol, close: close?.price ?? null, closeDate: close?.date || null,
          previousClose: prior?.price ?? null, weekPct: close && prior ? (close.price * splitFactor / prior.price - 1) * 100 : null,
          value: close ? clean(p.shares * close.price) : null };
      }).sort((a, b) => (b.value || 0) - (a.value || 0));
      const missing = holdings.filter(p => p.value === null).map(p => p.symbol);
      if (missing.length) issues.push(`Closing prices unavailable: ${missing.join(', ')}.`);
      const total = balance && !negative && !missing.length ? clean(balance.cash + holdings.reduce((n, p) => n + p.value, 0)) : null;
      let beginning = previous ? previous.cash : null;
      for (const p of previous?.positions || []) {
        const close = closeAt(prices, p.symbol, periodStart);
        if (!close) { beginning = null; break; }
        beginning += p.shares * close.price;
      }
      const flows = activity.map(t => ({ date: t.date, ...effect(t) }));
      const external = flows.reduce((n, f) => n + f.external, 0);
      const duration = (Date.parse(date) - Date.parse(periodStart)) / DAY;
      const weighted = flows.reduce((n, f) => n + f.external * ((Date.parse(date) - Date.parse(f.date)) / DAY) / duration, 0);
      // Modified Dietz estimates time-weighted performance, assuming external flows occur at day-end.
      const profit = total !== null && beginning !== null && covered && !negative && !captureMismatch && !flows.some(f => f.unknownFlow) ? clean(total - beginning - external) : null;
      const weekPct = profit !== null && beginning + weighted > 0 ? profit / (beginning + weighted) * 100 : null;
      if (!upcoming && total !== null && weekPct === null && covered) issues.push('The prior closing value or transfer valuation is unavailable; weekly return is pending.');
      holdings.forEach(p => { p.weight = total > 0 && p.value !== null ? p.value / total * 100 : null; });
      return { date, periodStart, upcoming, status: upcoming ? 'upcoming' : weekPct !== null ? 'ready' : balance ? 'partial' : 'needs-data',
        source: captured ? 'captured' : 'reconstructed', total, cash: balance?.cash ?? null,
        weekPct, profit, externalFlows: clean(external), holdings, transactions: upcoming ? [] : activity,
        tradeCount: activity.filter(t => ['Buy', 'Sell'].includes(t.action) && !CASH_SYMBOLS.has(t.symbol)).length, issues };
    });
    const opening = anchor ? balanceAt(anchor, START, transactions, prices) : null;
    const openingPrices = opening?.positions.map(p => ({ shares: p.shares, close: closeAt(prices, p.symbol, START)?.price })) || [];
    const openingValue = opening && openingPrices.every(p => p.close !== undefined)
      ? opening.cash + openingPrices.reduce((n, p) => n + p.shares * p.close, 0) : null;
    const reconciliation = openingValue !== null && Number.isFinite(anchor?.referenceStartValue)
      ? { openingValue, reportedOpeningValue: anchor.referenceStartValue, difference: openingValue - anchor.referenceStartValue } : null;
    const result = { year, account, accounts: ACCOUNTS, years: Array.from({ length: Number(now.date.slice(0, 4)) - 2025 }, (_, i) => 2026 + i),
      coverage: coverage || null, anchor: anchor ? { date: anchor.date, source: anchor.source } : null,
      pricesUpdatedAt: prices.updatedAt, reconciliation, weeks, method: 'Modified Dietz; day-end external flows; includes cash, dividends and fees.' };
    return result;
  }

  /** Persist reproducible yearly snapshots after refreshing prices or source records. */
  function rebuild() {
    const currentYear = Number(marketTime(clock()).date.slice(0, 4));
    for (let year = 2026; year <= currentYear; year++) {
      const result = getYear(year);
      writeJson(path.join(root, 'snapshots', `${year}.json`), result);
    }
  }

  return { state, importCsv, setAnchor, captureLive, getPrices, savePrices, getYear, rebuild, balanceAt, closeAt };
}

module.exports = { createFridayLogStore, ACCOUNTS, CASH_SYMBOLS, parseTransactions, effect, fridays, validDate, shift, marketTime };
