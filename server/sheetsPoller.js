/**
 * sheetsPoller.js — Fetches and caches live portfolio data from a public Google Sheet.
 *
 * Polls the sheet's CSV export on a configurable interval (default: 1 hour).
 * Parses per-stock positions and aggregate portfolio metrics.
 */

const https = require('https');

const SHEETS_URL = process.env.SHEETS_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/1fme7KenYvt4-a-1NkTxajzRSmlam1zwx-3vDevbYX4U/gviz/tq?tqx=out:csv';

const POLL_INTERVAL_MS = parseInt(process.env.SHEETS_POLL_INTERVAL_MS) || (60 * 60 * 1000); // 1 hour

let cachedData = null;
let lastFetchTime = null;
let pollingTimer = null;

// ── CSV Parsing ─────────────────────────────────────────────────────────────

/** Split a CSV row respecting quoted commas. */
function splitCSVRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/** Strip dollar signs, commas, parentheses (negative), whitespace from a value and parse as float. */
function parseNum(raw) {
  if (!raw || raw === '' || raw === '-') return null;
  // Handle accounting negative: $(73,620.43) → -73620.43
  const isNeg = raw.includes('(') && raw.includes(')');
  const cleaned = raw.replace(/[$,%()"\s]/g, '').replace(/,/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  return isNeg ? -n : n;
}

/**
 * Parse the full CSV into a structured portfolio object.
 *
 * CSV layout (0-indexed rows from the gviz export):
 *   Row 0:       Header row with "total" label and portfolio value
 *   Rows 1–14:   Stock/cash positions
 *   Row 15:      Total gain $ in col 17
 *   Row 16:      Daily change summary row
 *   Rows 17+:    Labelled summary rows (Start of the Year, YTD Change, etc.)
 *
 * Per-stock columns (0-indexed):
 *   0: Ticker   1: Shares   2: Weight%   3: Current price
 *   5: Position value   13: Avg buy price   15: Total gain/loss %
 *   17: Gain/loss $   22: Daily change %
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const rows = lines.map(splitCSVRow);

  const data = {
    stocks: [],
    cash: null,
    portfolioMetrics: {},
    lastFetchTime: new Date().toISOString(),
  };

  // ── Row 0: Total portfolio value (col 29 or search for the number next to "total")
  const row0 = rows[0] || [];
  const totalIdx = row0.findIndex(c => c.toLowerCase() === 'total');
  if (totalIdx >= 0 && row0[totalIdx + 1]) {
    data.portfolioMetrics.totalValue = parseNum(row0[totalIdx + 1]);
  }

  // ── Stock rows (rows 1–14 in the CSV)
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const ticker = (cols[0] || '').toUpperCase();

    // Stop when we hit a non-ticker row (empty col 0 or a label like "Start of the Year")
    if (!ticker || ticker.length > 6) break;

    const shares = parseNum(cols[1]);

    if (ticker === 'CASH') {
      data.cash = {
        value: shares, // For cash, the "shares" column holds the dollar amount
        weightPct: parseNum(cols[2]),
      };
      continue;
    }

    // Only include holdings with shares > 0
    if (shares === null || shares <= 0) continue;

    const currentPrice = parseNum(cols[3]);
    const avgBuyPrice = parseNum(cols[13]);
    const positionValue = parseNum(cols[5]);
    const totalGainPct = parseNum(cols[15]);
    const dayChangePct = parseNum(cols[22]);

    // Compute gain/loss % from price data if the sheet doesn't have it
    let gainLossPct = totalGainPct;
    if (gainLossPct === null && currentPrice && avgBuyPrice) {
      gainLossPct = ((currentPrice / avgBuyPrice) - 1) * 100;
    }

    data.stocks.push({
      ticker,
      shares,
      weightPct: parseNum(cols[2]) || 0,
      currentPrice: currentPrice || 0,
      avgBuyPrice: avgBuyPrice || 0,
      dayChangePct: dayChangePct || 0,
      gainLossPct: gainLossPct !== null ? Math.round(gainLossPct * 100) / 100 : null,
      positionValue: positionValue || 0,
    });
  }

  // ── Labelled summary rows: find by col-0 text
  const labelMap = {};
  for (let i = 0; i < rows.length; i++) {
    const label = (rows[i][0] || '').toLowerCase().trim();
    if (label) labelMap[label] = rows[i];
  }

  const startYearRow = labelMap['start of the year'];
  const ytdChangeRow = labelMap['ytd change'];
  const pctChangeRow = labelMap['percent change'];
  const spStartRow = labelMap['s&p start year'];
  const spCurrentRow = labelMap['s&p current'];
  const spPctRow = labelMap['s&p % change'];
  const vsSPRow = labelMap['me vs s&p'];

  if (startYearRow) data.portfolioMetrics.startYearValue = parseNum(startYearRow[1]);
  if (ytdChangeRow) data.portfolioMetrics.ytdChangeDollars = parseNum(ytdChangeRow[1]);
  if (pctChangeRow) data.portfolioMetrics.ytdChangePct = parseNum(pctChangeRow[1]);
  if (spStartRow) data.portfolioMetrics.spStartYear = parseNum(spStartRow[1]);
  if (spCurrentRow) data.portfolioMetrics.spCurrent = parseNum(spCurrentRow[1]);
  if (spPctRow) data.portfolioMetrics.spChangePct = parseNum(spPctRow[1]);
  if (vsSPRow) data.portfolioMetrics.vsSP = parseNum(vsSPRow[1]);

  // ── Daily portfolio change: row 16 (the summary row after stocks), col 22
  // This row has daily % change in col 22 and raw $ change in col 19
  // Find it: it's the first empty-ticker row after stock data
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const ticker = (cols[0] || '').trim();
    if (ticker === '') {
      // Check if this row has a value in col 22 (daily % change)
      const dayPct = parseNum(cols[22]);
      if (dayPct !== null) {
        data.portfolioMetrics.dayChangePct = dayPct;
        break;
      }
      // Or check col 19 for the raw $ change
      const dayDollar = parseNum(cols[19]);
      if (dayDollar !== null && !data.portfolioMetrics.dayChangePct) {
        // Calculate % from dollar change and total value
        if (data.portfolioMetrics.totalValue) {
          data.portfolioMetrics.dayChangePct =
            (dayDollar / data.portfolioMetrics.totalValue) * 100;
        }
      }
    }
  }

  // Fallback: compute total from stock weights × stock day changes
  if (data.portfolioMetrics.dayChangePct === undefined || data.portfolioMetrics.dayChangePct === null) {
    let weightedSum = 0;
    let weightSum = 0;
    data.stocks.forEach(s => {
      if (s.dayChangePct !== 0 && s.weightPct > 0) {
        weightedSum += s.dayChangePct * s.weightPct;
        weightSum += s.weightPct;
      }
    });
    if (weightSum > 0) {
      data.portfolioMetrics.dayChangePct = weightedSum / weightSum;
    } else {
      data.portfolioMetrics.dayChangePct = 0;
    }
  }

  // Total portfolio value fallback: sum position values + cash
  if (!data.portfolioMetrics.totalValue) {
    const stockTotal = data.stocks.reduce((s, st) => s + st.positionValue, 0);
    const cashVal = data.cash ? data.cash.value : 0;
    data.portfolioMetrics.totalValue = stockTotal + cashVal;
  }

  return data;
}

// ── HTTP Fetching ───────────────────────────────────────────────────────────

function fetchSheetCSV(retries = 3) {
  return new Promise((resolve, reject) => {
    const doFetch = (url, retriesLeft) => {
      const req = https.get(url, { timeout: 10000 }, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doFetch(res.headers.location, retriesLeft);
        }
        if (res.statusCode !== 200) {
          const err = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
          if (retriesLeft > 0) {
            console.log(`[sheetsPoller] HTTP ${res.statusCode}, retrying... (${retriesLeft} left)`);
            setTimeout(() => doFetch(url, retriesLeft - 1), 1000 * (4 - retriesLeft));
          } else {
            reject(err);
          }
          res.resume(); // consume response to free memory
          return;
        }
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(body));
      });

      req.on('error', (err) => {
        if (retriesLeft > 0) {
          console.log(`[sheetsPoller] Fetch error, retrying... (${retriesLeft} left)`);
          setTimeout(() => doFetch(url, retriesLeft - 1), 1000 * (4 - retriesLeft));
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (retriesLeft > 0) {
          console.log(`[sheetsPoller] Timeout, retrying... (${retriesLeft} left)`);
          setTimeout(() => doFetch(url, retriesLeft - 1), 1000 * (4 - retriesLeft));
        } else {
          reject(new Error('Request timeout after retries'));
        }
      });
    };

    doFetch(SHEETS_URL, retries);
  });
}

// ── Polling & Cache ─────────────────────────────────────────────────────────

async function fetchAndCache() {
  try {
    console.log('[sheetsPoller] Fetching Google Sheets data...');
    const csv = await fetchSheetCSV();
    cachedData = parseCSV(csv);
    lastFetchTime = cachedData.lastFetchTime;
    console.log(
      `[sheetsPoller] Cached ${cachedData.stocks.length} stocks` +
      (cachedData.cash ? ` + cash` : '') +
      `, total: $${(cachedData.portfolioMetrics.totalValue || 0).toLocaleString()}`
    );
  } catch (err) {
    console.error('[sheetsPoller] Fetch failed:', err.message);
    // Keep stale cached data if available
  }
}

function startPolling(intervalMs = POLL_INTERVAL_MS) {
  fetchAndCache(); // fetch immediately on startup
  pollingTimer = setInterval(fetchAndCache, intervalMs);
  console.log(`[sheetsPoller] Polling every ${Math.round(intervalMs / 1000 / 60)} minutes`);
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

function getLiveData() {
  if (!cachedData) {
    return { stocks: [], cash: null, portfolioMetrics: {}, lastFetchTime: null, loading: true };
  }
  return { ...cachedData, lastFetchTime };
}

async function forceRefresh() {
  await fetchAndCache();
  return getLiveData();
}

module.exports = { startPolling, stopPolling, getLiveData, forceRefresh };
