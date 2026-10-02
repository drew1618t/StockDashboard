const { ACCOUNTS, CASH_SYMBOLS, START, isOption } = require('./fridayLogStore');

const DAY = 86400000;
const BUY_ACTIONS = new Set(['Buy', 'Reinvest Shares', 'Buy to Open']);
const SELL_ACTIONS = new Set(['Sell', 'Sell to Close']);
const DIVIDEND_ACTIONS = new Set(['Qualified Dividend', 'Cash Dividend', 'Reinvest Dividend']);
const INTEREST_ACTIONS = new Set(['Bank Interest', 'Credit Interest']);
const FEE_ACTIONS = new Set(['ADR Mgmt Fee', 'Service Fee', 'Margin Interest', 'Misc Cash Entry']);
const EXTERNAL_ACTIONS = new Set(['MoneyLink Transfer', 'Funds Received', 'Wire Sent']);
const JOURNAL_ACTIONS = new Set(['Journaled Shares', 'Journal']);

/** Round money and share noise without discarding fractional shares. */
function clean(n) { return n === null || n === undefined ? null : Math.round(n * 1e8) / 1e8; }

/** Sum values that may be unknown; one unknown makes the total unknown rather than understated. */
function sumKnown(values) {
  let total = 0;
  for (const value of values) { if (value === null || value === undefined) return null; total += value; }
  return clean(total);
}

/** Express a gain against the capital it was earned on. */
function ratio(gain, base) { return gain === null || !base ? null : clean(gain / base * 100); }

/** Latest downloaded close on or before a date, in the share units traded that day. */
function closeOn(prices, symbol, date) {
  const closes = prices.symbols[symbol]?.closes || {};
  const session = Object.keys(closes).filter(d => !date || d <= date).sort().at(-1);
  return session ? { price: closes[session], date: session } : null;
}

/** Ordinal date difference used for holding periods. */
function days(from, to) { return Math.round((Date.parse(to) - Date.parse(from)) / DAY); }

/** Turn a ledger record into a lot-matching event; journals only move shares between accounts. */
function securityEvent(tx, account) {
  if (!tx.symbol || CASH_SYMBOLS.has(tx.symbol)) return null;
  if (BUY_ACTIONS.has(tx.action) || SELL_ACTIONS.has(tx.action)) {
    // Option contracts cover 100 shares, so per-share prices stay comparable with the quoted premium.
    const multiplier = isOption(tx.symbol) ? 100 : 1;
    return { kind: SELL_ACTIONS.has(tx.action) ? 'sell' : 'buy', shares: tx.quantity * multiplier, price: tx.price,
      value: tx.amount === null ? null : Math.abs(tx.amount) };
  }
  // Internal transfers cancel in the combined view; a single account sees them as a transfer in or out.
  if (JOURNAL_ACTIONS.has(tx.action) && account !== 'all' && tx.quantity) {
    return { kind: tx.quantity > 0 ? 'buy' : 'sell', shares: Math.abs(tx.quantity), price: tx.price,
      value: tx.price === null ? null : Math.abs(tx.quantity) * tx.price, transfer: true };
  }
  return null;
}

/** Journals that net to nothing within one account on one day are bookkeeping, not transfers. */
function cancelledJournals(records) {
  const groups = new Map();
  for (const tx of records) {
    if (!JOURNAL_ACTIONS.has(tx.action) || !tx.symbol) continue;
    const key = `${tx.account}|${tx.date}|${tx.symbol}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }
  const cancelled = new Set();
  for (const group of groups.values()) {
    if (Math.abs(group.reduce((n, t) => n + (t.quantity || 0), 0)) < 1e-9) group.forEach(t => cancelled.add(t.id));
  }
  return cancelled;
}

/**
 * Build FIFO trade statistics for one account or the combined portfolio over a date range.
 * Every recorded trade builds the lot book, so gains use real purchase cost. Shares held before the
 * ledger's first day are opening lots priced at that day's close. Only sells, buys, income and
 * valuations dated within [from, asOf] are reported.
 */
function buildTradeStats({ transactions, prices, opening = [], openingDate = START, account = 'all', from = null, asOf = null, type = 'all' }) {
  if (!['all', 'stocks', 'options'].includes(type)) throw new Error('Choose stocks, options or all');
  const records = transactions.filter(t => (account === 'all' || t.account === account) && (!asOf || t.date <= asOf));
  /** Stocks and option contracts can be reported apart; cash rows without a symbol belong to both. */
  const wanted = symbol => type === 'all' || !symbol || isOption(symbol) === (type === 'options');
  const inPeriod = tx => !from || tx.date >= from;
  const names = {};
  records.forEach(t => { if (t.symbol && t.description) names[t.symbol] = t.description; });
  const cancelled = cancelledJournals(records);
  const symbols = new Map();
  /** Lazily create per-symbol state so dividends-only symbols never appear as trades. */
  const state = symbol => {
    if (!symbols.has(symbol)) {
      symbols.set(symbol, { symbol, lots: [], roundTrips: [], sells: [], buys: 0, sellCount: 0, sharesBought: 0, sharesSold: 0,
        invested: 0, proceeds: 0, dividends: 0, accounts: new Set(), firstDate: null, lastDate: null, openingShares: 0, splitFactor: 1, cycle: null, positions: [] });
    }
    return symbols.get(symbol);
  };
  const openingPrice = symbol => closeOn(prices, symbol, openingDate)?.price ?? null;
  /** A position runs from its first lot until every share is gone; that whole run is one win or loss. */
  const openCycle = (s, date) => { if (!s.cycle) s.cycle = { start: date, gain: 0, cost: 0, proceeds: 0, sells: 0, known: true, accounts: new Set() }; };
  for (const position of opening) {
    if (position.shares <= 0 || CASH_SYMBOLS.has(position.symbol)) continue;
    const s = state(position.symbol);
    s.lots.push({ date: openingDate, shares: position.shares, costPerShare: openingPrice(position.symbol), opening: true, account: 'all' });
    s.openingShares += position.shares; openCycle(s, openingDate);
  }
  // Splits change lot share counts before the ex-date session; merge them with dated trades.
  const events = [];
  for (const tx of records) {
    if (cancelled.has(tx.id)) continue;
    const event = securityEvent(tx, account);
    if (event) events.push({ date: tx.date, order: 1, tx, ...event });
  }
  for (const [symbol, quote] of Object.entries(prices.symbols)) {
    for (const split of quote.splits || []) if (split.date > openingDate && (!asOf || split.date <= asOf)) events.push({ date: split.date, order: 0, split: true, symbol, ratio: split.ratio });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || (a.tx && b.tx ? a.tx.id.localeCompare(b.tx.id) : 0));

  for (const event of events) {
    if (event.split) {
      if (!symbols.has(event.symbol)) continue;
      const s = symbols.get(event.symbol); s.splitFactor *= event.ratio;
      for (const lot of s.lots) { lot.shares *= event.ratio; if (lot.costPerShare !== null) lot.costPerShare /= event.ratio; }
      continue;
    }
    const { tx } = event, s = state(tx.symbol), counted = inPeriod(tx) && !event.transfer;
    s.accounts.add(tx.account);
    if (counted) { s.firstDate = s.firstDate || tx.date; s.lastDate = tx.date; }
    if (event.kind === 'buy') {
      const cost = event.value ?? (event.price === null ? null : event.shares * event.price);
      s.lots.push({ date: tx.date, shares: event.shares, costPerShare: cost === null ? null : cost / event.shares, account: tx.account, transfer: !!event.transfer });
      openCycle(s, tx.date);
      if (counted) { s.buys++; s.sharesBought += event.shares; s.invested += cost || 0; }
      continue;
    }
    let remaining = event.shares;
    const proceeds = event.value ?? (event.price === null ? null : event.shares * event.price);
    const sellPrice = proceeds === null ? event.price : proceeds / event.shares;
    const chunks = [];
    while (remaining > 1e-9) {
      let lot = s.lots[0];
      // Shares sold beyond recorded purchases were held before the ledger began: price them at its first close.
      if (!lot) {
        const price = openingPrice(tx.symbol);
        lot = { date: openingDate, shares: remaining, costPerShare: price === null ? null : price / s.splitFactor, opening: true, account: tx.account };
        s.lots.push(lot); s.openingShares += remaining / s.splitFactor; openCycle(s, openingDate);
      }
      const shares = Math.min(remaining, lot.shares);
      const cost = lot.costPerShare === null ? null : shares * lot.costPerShare;
      const chunkProceeds = sellPrice === null ? null : shares * sellPrice;
      const gain = cost === null || chunkProceeds === null ? null : chunkProceeds - cost;
      const trip = { symbol: tx.symbol, account: tx.account, buyDate: lot.date, sellDate: tx.date, shares: clean(shares),
        buyPrice: clean(lot.costPerShare), sellPrice: clean(sellPrice), cost: clean(cost), proceeds: clean(chunkProceeds),
        gain: clean(gain), gainPct: ratio(gain, cost), days: days(lot.date, tx.date), opening: !!lot.opening, transfer: !!event.transfer || !!lot.transfer };
      if (inPeriod(tx)) s.roundTrips.push(trip);
      chunks.push(trip);
      lot.shares -= shares; remaining -= shares;
      if (lot.shares <= 1e-9) s.lots.shift();
    }
    const cycle = s.cycle;
    if (!event.transfer) {
      cycle.sells++; cycle.accounts.add(tx.account); cycle.proceeds += proceeds || 0;
      for (const c of chunks) { if (c.gain === null) cycle.known = false; else { cycle.gain += c.gain; cycle.cost += c.cost; } }
    }
    if (!s.lots.length) {
      // Fully out: the position is decided. Shares journaled away simply leave this account undecided.
      s.cycle = null;
      if (!event.transfer && inPeriod(tx)) {
        const gain = cycle.known ? clean(cycle.gain) : null;
        s.positions.push({ symbol: tx.symbol, account: tx.account, accounts: [...cycle.accounts].sort(), start: cycle.start, date: tx.date,
          days: days(cycle.start, tx.date), sells: cycle.sells, cost: clean(cycle.cost), proceeds: clean(cycle.proceeds), gain, gainPct: ratio(gain, cycle.cost) });
      }
    }
    if (!counted) continue;
    s.sellCount++; s.sharesSold += event.shares; s.proceeds += proceeds || 0;
    const cost = sumKnown(chunks.map(c => c.cost)), gain = sumKnown(chunks.map(c => c.gain));
    s.sells.push({ id: tx.id, symbol: tx.symbol, account: tx.account, date: tx.date, shares: clean(event.shares), price: clean(sellPrice),
      proceeds: clean(proceeds), cost, gain, gainPct: ratio(gain, cost), opening: chunks.some(c => c.opening),
      days: Math.round(chunks.reduce((n, c) => n + c.days * c.shares, 0) / event.shares) });
  }
  for (const tx of records) {
    if (tx.symbol && inPeriod(tx) && DIVIDEND_ACTIONS.has(tx.action) && symbols.has(tx.symbol) && tx.action !== 'Reinvest Dividend') symbols.get(tx.symbol).dividends += tx.amount || 0;
  }

  const list = [...symbols.values()].map(s => {
    const openShares = clean(s.lots.reduce((n, l) => n + l.shares, 0));
    const openCost = sumKnown(s.lots.map(l => l.costPerShare === null ? null : l.shares * l.costPerShare));
    const close = closeOn(prices, s.symbol, asOf);
    const marketValue = openShares > 0 && close ? clean(openShares * close.price) : null;
    const unrealized = marketValue !== null && openCost !== null ? clean(marketValue - openCost) : null;
    const realized = sumKnown(s.sells.map(x => x.gain));
    const closedCost = sumKnown(s.sells.map(x => x.cost));
    const wins = s.positions.filter(x => x.gain !== null && x.gain > 0).length;
    const losses = s.positions.filter(x => x.gain !== null && x.gain < 0).length;
    const decided = wins + losses;
    const avgCost = openShares > 0 && openCost !== null ? clean(openCost / openShares) : null;
    return { symbol: s.symbol, name: names[s.symbol] || s.symbol, accounts: [...s.accounts].sort(), option: isOption(s.symbol),
      status: openShares > 0 ? 'open' : 'closed', buys: s.buys, sells: s.sellCount,
      sharesBought: clean(s.sharesBought), sharesSold: clean(s.sharesSold), openingShares: clean(s.openingShares),
      invested: clean(s.invested), proceeds: clean(s.proceeds), costSold: closedCost, realized, realizedPct: ratio(realized, closedCost),
      // Average buy is the real cost of the shares sold, whenever they were bought; unsold positions show their lot cost.
      avgBuyPrice: s.sharesSold > 0 ? (closedCost === null ? null : clean(closedCost / s.sharesSold)) : avgCost,
      avgSellPrice: s.sharesSold > 0 ? clean(s.proceeds / s.sharesSold) : null,
      wins, losses, winRate: decided ? clean(wins / decided * 100) : null, dividends: clean(s.dividends),
      openShares, openCost, avgCost,
      lastClose: close?.price ?? null, lastCloseDate: close?.date ?? null, marketValue, unrealized, unrealizedPct: ratio(unrealized, openCost),
      heldSince: s.lots[0]?.date || null, firstDate: s.firstDate, lastDate: s.lastDate,
      transactions: records.filter(t => t.symbol === s.symbol), sellEvents: s.sells, roundTrips: s.roundTrips, positions: s.positions };
  }).filter(s => (s.buys || s.sells || s.openShares > 0) && wanted(s.symbol))
    .sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || '') || a.symbol.localeCompare(b.symbol));

  const sells = list.flatMap(s => s.sellEvents).sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol));
  // Wins and losses are whole positions, decided only once every share is sold; a trim on its own is not a result.
  const positions = list.flatMap(s => s.positions).sort((a, b) => b.date.localeCompare(a.date) || a.symbol.localeCompare(b.symbol));
  const decided = positions.filter(x => x.gain !== null && x.gain !== 0);
  const wins = decided.filter(x => x.gain > 0), losses = decided.filter(x => x.gain < 0);
  const average = (items, key) => items.length ? clean(items.reduce((n, x) => n + x[key], 0) / items.length) : null;
  // Rank by percentage so a small position can still be the best or worst decision.
  const closedRanked = list.filter(s => s.status === 'closed' && s.realizedPct !== null).sort((a, b) => b.realizedPct - a.realizedPct);
  const openRanked = list.filter(s => s.status === 'open' && s.unrealizedPct !== null).sort((a, b) => b.unrealizedPct - a.unrealizedPct);
  const closedSummary = s => s ? { symbol: s.symbol, realized: s.realized, realizedPct: s.realizedPct, avgBuyPrice: s.avgBuyPrice, avgSellPrice: s.avgSellPrice, firstDate: s.firstDate || s.heldSince, lastDate: s.lastDate } : null;
  const openSummary = s => s ? { symbol: s.symbol, unrealized: s.unrealized, unrealizedPct: s.unrealizedPct, openCost: s.openCost, marketValue: s.marketValue, heldSince: s.heldSince } : null;
  const realized = sumKnown(list.map(s => s.realized)), closedCost = sumKnown(sells.map(x => x.cost));
  const openCost = sumKnown(list.filter(s => s.status === 'open').map(s => s.openCost));
  const unrealized = sumKnown(list.filter(s => s.status === 'open').map(s => s.unrealized));
  const period = records.filter(t => inPeriod(t) && wanted(t.symbol));
  const cashflow = (predicate, sign = 1) => clean(period.filter(predicate).reduce((n, t) => n + Math.max(0, sign * (t.amount || 0)), 0));
  const overall = {
    symbols: list.length, open: list.filter(s => s.status === 'open').length, closed: list.filter(s => s.status === 'closed').length,
    buys: list.reduce((n, s) => n + s.buys, 0), sells: sells.length,
    invested: clean(list.reduce((n, s) => n + s.invested, 0)), proceeds: clean(list.reduce((n, s) => n + s.proceeds, 0)),
    realized, realizedPct: ratio(realized, closedCost), openCost, unrealized, unrealizedPct: ratio(unrealized, openCost),
    positions: positions.length, wins: wins.length, losses: losses.length, breakeven: positions.filter(x => x.gain === 0).length, unknown: positions.filter(x => x.gain === null).length,
    winRate: decided.length ? clean(wins.length / decided.length * 100) : null,
    avgWinPct: average(wins, 'gainPct'), avgLossPct: average(losses, 'gainPct'), avgWin: average(wins, 'gain'), avgLoss: average(losses, 'gain'),
    avgHoldDays: positions.length ? Math.round(positions.reduce((n, x) => n + x.days, 0) / positions.length) : null,
    avgWinHoldDays: wins.length ? Math.round(wins.reduce((n, x) => n + x.days, 0) / wins.length) : null,
    avgLossHoldDays: losses.length ? Math.round(losses.reduce((n, x) => n + x.days, 0) / losses.length) : null,
    profitFactor: losses.length && wins.length ? clean(wins.reduce((n, x) => n + x.gain, 0) / -losses.reduce((n, x) => n + x.gain, 0)) : null,
    bestClosed: closedSummary(closedRanked[0]), worstClosed: closedSummary(closedRanked.at(-1)),
    bestOpen: openSummary(openRanked[0]), worstOpen: openSummary(openRanked.at(-1)),
    dividends: cashflow(t => DIVIDEND_ACTIONS.has(t.action)), interest: cashflow(t => INTEREST_ACTIONS.has(t.action)),
    fees: clean(period.reduce((n, t) => n + Math.abs(t.fees || 0), 0) + Math.abs(period.filter(t => FEE_ACTIONS.has(t.action)).reduce((n, t) => n + (t.amount || 0), 0))),
    deposits: cashflow(t => EXTERNAL_ACTIONS.has(t.action)), withdrawals: cashflow(t => EXTERNAL_ACTIONS.has(t.action), -1),
  };

  /** Aggregate buys, sells and realized results under a grouping key. */
  const group = (keyOf, label) => {
    const buckets = new Map();
    const bucket = key => { if (!buckets.has(key)) buckets.set(key, { key, label: label(key), buys: 0, sells: 0, invested: 0, proceeds: 0, realized: 0, realizedKnown: true, wins: 0, losses: 0, symbols: new Set() }); return buckets.get(key); };
    for (const tx of period) {
      const event = cancelled.has(tx.id) ? null : securityEvent(tx, account);
      if (!event || event.transfer) continue;
      const b = bucket(keyOf(tx)); b.symbols.add(tx.symbol);
      if (event.kind === 'buy') { b.buys++; b.invested += event.value || 0; } else { b.sells++; b.proceeds += event.value || 0; }
    }
    for (const sell of sells) {
      const b = bucket(keyOf(sell));
      if (sell.gain === null) b.realizedKnown = false; else b.realized += sell.gain;
    }
    for (const position of positions) {
      const b = bucket(keyOf(position));
      if (position.gain > 0) b.wins++; else if (position.gain < 0) b.losses++;
    }
    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)).map(b => ({ ...b, symbols: b.symbols.size,
      invested: clean(b.invested), proceeds: clean(b.proceeds), realized: b.realizedKnown ? clean(b.realized) : null }));
  };
  const byMonth = group(t => t.date.slice(0, 7), key => key);
  const byAccount = account === 'all' ? group(t => t.account, key => ACCOUNTS[key] || key) : [];
  const byType = type === 'all' ? group(t => isOption(t.symbol) ? 'options' : 'stocks', key => key === 'options' ? 'Option contracts' : 'Stocks') : [];
  return { account, accounts: ACCOUNTS, from, to: asOf, type, openingDate, overall, symbols: list, sells, positions, byMonth, byAccount, byType,
    method: `FIFO lots per account, built from every recorded trade. Shares held before ${openingDate} use that day's close as cost. Journaled shares move lots between accounts at the journal price.` };
}

module.exports = { buildTradeStats, securityEvent, closeOn };
