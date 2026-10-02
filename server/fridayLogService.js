const { createFridayLogStore, CASH_SYMBOLS, START, marketTime, shift, isOption, earliestDate } = require('./fridayLogStore');

/** Quotes are needed from just before the ledger's first day, or December 2025 for a ledger that starts later. */
const DEFAULT_FROM = '2025-12-20';

/** New York hour after which today's close is final; the first run after it downloads that close. */
const CLOSE_HOUR = 16;

/** Convert Yahoo's split-adjusted closes back to prices in the share units traded on each date. */
function normalizeChart(result, through) {
  if (!result?.timestamp || !result.indicators?.quote?.[0]?.close) throw new Error('No daily closing prices returned');
  const splits = Object.values(result.events?.splits || {}).map(s => ({
    date: new Date(s.date * 1000).toISOString().slice(0, 10), ratio: s.numerator / s.denominator,
  })).filter(s => s.date <= through && Number.isFinite(s.ratio) && s.ratio > 0);
  const closes = {};
  result.timestamp.forEach((timestamp, i) => {
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const close = result.indicators.quote[0].close[i];
    if (date > through || !Number.isFinite(close) || close <= 0) return;
    const factor = splits.filter(s => s.date > date).reduce((n, s) => n * s.ratio, 1);
    closes[date] = close * factor;
  });
  return { closes, splits };
}

/** Coordinate bounded quote downloads, persistent Friday capture, and restart catch-up. */
function createFridayLogService(options = {}) {
  const store = options.store || createFridayLogStore();
  const fetcher = options.fetch || fetch;
  const now = options.now || (() => new Date());
  let running = null, timer = null, lastAttempt = 0;

  /** Download daily history from the requested day to keep post-split historical prices internally consistent. */
  async function fetchSymbol(symbol, from = DEFAULT_FROM) {
    const end = Math.floor(+now() / 1000) + 86400;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000)}&period2=${end}&interval=1d&events=splits`;
    const response = await fetcher(url, { headers: { 'User-Agent': 'StockDashboard/1.0' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Price provider HTTP ${response.status}`);
    const json = await response.json();
    if (json.chart?.error) throw new Error(json.chart.error.description || 'Price provider error');
    const time = marketTime(now());
    return { ...normalizeChart(json.chart?.result?.[0], time.date), from,
      finalThrough: time.hour >= CLOSE_HOUR ? time.date : shift(time.date, -1) };
  }

  /** Refresh quotes with three workers and preserve previous data when a provider request fails. */
  async function refreshPrices() {
    const state = store.state(), prices = store.getPrices();
    const symbols = new Set(['SPY']), latest = {};
    state.transactions.forEach(t => {
      if (!t.symbol || CASH_SYMBOLS.has(t.symbol) || isOption(t.symbol)) return;
      symbols.add(t.symbol); latest[t.symbol] = [latest[t.symbol] || '', t.date].sort().pop();
    });
    [...Object.values(state.anchors), ...Object.values(state.captures)].forEach(a => a.positions.forEach(p => { symbols.add(p.symbol); latest[p.symbol] = START; }));
    const from = [shift(earliestDate(state.transactions) || DEFAULT_FROM, -10), DEFAULT_FROM].sort()[0];
    // A stock last touched before the quote window began keeps its saved history instead of being downloaded again.
    const queue = [...symbols].filter(s => !(latest[s] < DEFAULT_FROM && prices.symbols[s]?.from && prices.symbols[s].from <= from));
    /** Consume a shared queue to limit outbound requests and server memory. */
    async function worker() {
      while (queue.length) {
        const symbol = queue.shift();
        try {
          prices.symbols[symbol] = await fetchSymbol(symbol, from);
          delete prices.errors[symbol];
        } catch (err) { prices.errors[symbol] = err.message; }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    prices.updatedAt = now().toISOString();
    store.savePrices(prices);
    return prices;
  }

  /** Serialize refreshes so manual imports and the hourly job cannot overwrite one another's quotes. */
  function refresh() {
    if (running) return running;
    lastAttempt = +now();
    running = (async () => {
      const prices = await refreshPrices();
      store.rebuild();
      return { updatedAt: prices.updatedAt, errors: prices.errors };
    })().finally(() => { running = null; });
    return running;
  }

  /** Capture only fresh Friday balances; catch up covered historical weeks after downtime. */
  async function tick(sheetsPoller) {
    const time = marketTime(now());
    const friday = new Date(`${time.date}T00:00:00Z`).getUTCDay() === 5;
    if (friday && time.hour >= 18 && !store.state().captures[time.date]) {
      const live = await sheetsPoller.forceRefresh();
      store.captureLive(live);
    }
    const last = store.getPrices().updatedAt;
    const lastTime = last ? marketTime(new Date(last)) : null;
    if (!last || (+now() - Date.parse(last) > 20 * 60 * 60 * 1000)
      || (time.hour >= CLOSE_HOUR && (lastTime.date < time.date || lastTime.hour < CLOSE_HOUR))) {
      if (+now() - lastAttempt > 30 * 60 * 1000) await refresh();
    } else store.rebuild();
  }

  /** Start an unref'ed hourly job; startup also repairs any covered Fridays missed while offline. */
  function start(sheetsPoller) {
    if (timer) return;
    /** Log background failures without bringing down the portfolio server. */
    const run = () => tick(sheetsPoller).catch(err => console.warn(`[friday-log] ${err.message}`));
    run(); timer = setInterval(run, 60 * 60 * 1000); timer.unref();
  }

  /** Stop background work for tests or graceful shutdown. */
  function stop() { if (timer) clearInterval(timer); timer = null; }
  return { store, refresh, start, stop, tick };
}

const service = createFridayLogService();
module.exports = { createFridayLogService, normalizeChart, service };
