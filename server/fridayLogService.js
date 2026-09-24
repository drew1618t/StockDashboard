const { createFridayLogStore, CASH_SYMBOLS, marketTime, shift } = require('./fridayLogStore');

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

  /** Download full daily history to keep post-split historical prices internally consistent. */
  async function fetchSymbol(symbol) {
    const end = Math.floor(+now() / 1000) + 86400;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=1766188800&period2=${end}&interval=1d&events=splits`;
    const response = await fetcher(url, { headers: { 'User-Agent': 'StockDashboard/1.0' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Price provider HTTP ${response.status}`);
    const json = await response.json();
    if (json.chart?.error) throw new Error(json.chart.error.description || 'Price provider error');
    const time = marketTime(now());
    return { ...normalizeChart(json.chart?.result?.[0], time.date),
      finalThrough: time.hour >= 18 ? time.date : shift(time.date, -1) };
  }

  /** Refresh quotes with three workers and preserve previous data when a provider request fails. */
  async function refreshPrices() {
    const state = store.state(), prices = store.getPrices();
    const symbols = new Set(['SPY']);
    state.transactions.forEach(t => { if (t.symbol && !CASH_SYMBOLS.has(t.symbol)) symbols.add(t.symbol); });
    [...Object.values(state.anchors), ...Object.values(state.captures)].forEach(a => a.positions.forEach(p => symbols.add(p.symbol)));
    const queue = [...symbols];
    /** Consume a shared queue to limit outbound requests and server memory. */
    async function worker() {
      while (queue.length) {
        const symbol = queue.shift();
        try {
          prices.symbols[symbol] = await fetchSymbol(symbol);
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
      || (friday && time.hour >= 18 && (lastTime.date < time.date || lastTime.hour < 18))) {
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
