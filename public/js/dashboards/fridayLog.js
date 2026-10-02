/** Performance area: Friday snapshots plus FIFO trade statistics and a ticker lookup, all from the ledger. */
const FridayLogDashboard = {
  root: null, data: null, selected: null, account: 'all', year: null, expanded: null, request: 0, momentumAll: false,
  view: 'fridays', trades: null, symbol: null, query: '', sort: 'recent', period: 'ytd', type: 'all',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  /** Escape all source and API text before interpolating HTML. */
  escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  /** Display unavailable data explicitly rather than turning it into a zero. */
  money(value, decimals = 0) { return value === null || value === undefined ? 'Pending' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }); },

  /** Format a signed portfolio or security return. */
  percent(value, decimals = 2) { return value === null || value === undefined ? 'Pending' : `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`; },

  /** Keep Friday labels independent of the browser's timezone. */
  date(value, long = false) { return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: long ? 'long' : 'short', day: 'numeric', ...(long ? { year: 'numeric' } : {}), timeZone: 'UTC' }); },

  /** Format a signed dollar result, keeping unknown values explicit. */
  gain(value, decimals = 0) { return value === null || value === undefined ? 'Pending' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${this.money(Math.abs(value), decimals)}`; },

  /** Format share counts without trailing float noise. */
  shares(value) { return value === null || value === undefined ? '' : value.toLocaleString('en-US', { maximumFractionDigits: 6 }); },

  /** Account names come from whichever payload is loaded for the active view. */
  accountName(id) { return (this.data || this.trades)?.accounts?.[id] || id; },

  /** Select semantic color only when a return is actually known. */
  tone(value) { return value === null || value === undefined ? 'fl-muted' : value > 0 ? 'fl-up' : value < 0 ? 'fl-down' : ''; },

  /** Attach controls once and restore shareable year/account/week selection from the hash. */
  async render(container) {
    this.root = container; this.root.className = 'friday-log';
    document.body.classList.add('friday-active');
    this.controller = new AbortController();
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    this.year = Number(params.get('year')) || new Date().getFullYear();
    this.account = params.get('account') || 'all'; this.selected = params.get('week');
    this.view = ['trades', 'momentum'].includes(params.get('view')) ? params.get('view') : 'fridays';
    this.symbol = (params.get('symbol') || '').toUpperCase() || null; this.query = this.symbol || '';
    this.period = /^(all|\d{4})$/.test(params.get('period') || '') ? params.get('period') : 'ytd';
    this.type = ['stocks', 'options'].includes(params.get('type')) ? params.get('type') : 'all';
    this.root.addEventListener('input', event => this.input(event), { signal: this.controller.signal });
    this.root.addEventListener('click', event => this.click(event), { signal: this.controller.signal });
    this.root.addEventListener('change', event => this.change(event), { signal: this.controller.signal });
    this.root.addEventListener('submit', event => this.import(event), { signal: this.controller.signal });
    await this.load();
  },

  /** Cancel event handlers and prevent late responses from painting into another dashboard. */
  destroy() { this.request++; this.controller?.abort(); this.root = null; document.body.classList.remove('friday-active'); },

  /** Fetch whichever view is active; each guards against out-of-order account responses. */
  async load() { return this.view === 'trades' ? this.loadTrades() : this.loadFridays(); },

  /** Date range for the chosen period; the server clamps the end to today and knows the ledger's first day. */
  periodRange() {
    if (this.period === 'all') return { from: '2000-01-01' };
    if (/^\d{4}$/.test(this.period)) return { from: `${this.period}-01-01`, to: `${this.period}-12-31` };
    return {};
  },

  /** Fetch every trade with FIFO results for the selected account and period. */
  async loadTrades() {
    const token = ++this.request;
    this.root.innerHTML = '<p class="fl-loading">Loading trade history…</p>';
    try {
      const range = Object.entries({ ...this.periodRange(), ...(this.type !== 'all' ? { type: this.type } : {}) }).map(([k, v]) => `&${k}=${v}`).join('');
      const trades = await API._requestJson(`/api/friday-log/trades?account=${encodeURIComponent(this.account)}${range}`);
      if (token !== this.request || !this.root?.isConnected) return;
      this.trades = trades;
      if (this.symbol && !trades.symbols.some(s => s.symbol === this.symbol)) { this.symbol = null; this.query = ''; }
      this.draw();
    } catch (error) {
      if (token === this.request && this.root) this.root.innerHTML = `<p class="fl-notice">${this.escape(error.message)}</p><button data-action="retry">Try again</button>`;
    }
  },

  /** Fetch uncached snapshots and guard against out-of-order account/year responses. */
  async loadFridays() {
    const token = ++this.request;
    this.root.innerHTML = '<p class="fl-loading">Loading Friday snapshots…</p>';
    try {
      const data = await API._requestJson(`/api/friday-log?year=${this.year}&account=${encodeURIComponent(this.account)}`);
      if (token !== this.request || !this.root?.isConnected) return;
      this.data = data;
      if (!data.weeks.some(w => w.date === this.selected && !w.upcoming)) this.selected = data.weeks.findLast(w => !w.upcoming)?.date;
      this.expanded = null; this.draw();
    } catch (error) {
      if (token === this.request && this.root) this.root.innerHTML = `<p class="fl-notice">${this.escape(error.message)}</p><button data-action="retry">Try again</button>`;
    }
  },

  /** Shared heading: view tabs plus the filters that apply to the active view. */
  headingHtml(title, blurb, filters) {
    return `<div class="fl-heading"><div><div class="fl-eyebrow">PERFORMANCE</div><h1>${title}</h1><p>${blurb}</p></div><div class="fl-controls"><div class="fl-tabs" role="tablist"><button role="tab" data-view="fridays" aria-selected="${this.view === 'fridays'}">Fridays</button><button role="tab" data-view="trades" aria-selected="${this.view === 'trades'}">Trades</button><button role="tab" data-view="momentum" aria-selected="${this.view === 'momentum'}">Momentum</button></div><div class="fl-filters">${filters}</div></div></div>`;
  },

  /** Period filter for trade statistics: each year the ledger covers, plus everything on record. */
  periodFilterHtml(t) {
    const thisYear = Number(t.today.slice(0, 4)), first = Number((t.ledgerStart || t.today).slice(0, 4));
    const options = [['ytd', `${thisYear} year to date`]];
    for (let year = thisYear - 1; year >= first; year--) options.push([String(year), String(year)]);
    options.push(['all', 'All time']);
    return `<label>Period<select data-filter="period" aria-label="Period">${options.map(([v, label]) => `<option value="${v}" ${this.period === v ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`;
  },

  /** Report stocks and option contracts together or apart. */
  typeFilterHtml() {
    const options = [['all', 'Stocks & options'], ['stocks', 'Stocks only'], ['options', 'Options only']];
    return `<label>Type<select data-filter="type" aria-label="Type">${options.map(([v, label]) => `<option value="${v}" ${this.type === v ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`;
  },

  /** Account filter shared by both views. */
  accountFilterHtml(accounts) {
    return `<label>Account<select data-filter="account" aria-label="Account"><option value="all">All accounts</option>${Object.entries(accounts).map(([id, name]) => `<option value="${id}" ${this.account === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`;
  },

  /** Render whichever view is active. */
  draw() {
    if (!this.root) return;
    if (this.view === 'trades') return this.drawTrades();
    if (this.view === 'momentum') return this.drawMomentum();
    const data = this.data, week = data.weeks.find(w => w.date === this.selected);
    const count = data.weeks.filter(w => !w.upcoming).length;
    // One absolute-return scale makes gains and losses comparable across the selected year/account.
    const largest = data.weeks.filter(w => !w.upcoming && Number.isFinite(w.weekPct))
      .reduce((best, w) => !best || Math.abs(w.weekPct) > Math.abs(best.weekPct) ? w : best, null);
    const maxMove = Math.abs(largest?.weekPct || 0);
    history.replaceState(null, '', `#friday-log?year=${data.year}&account=${encodeURIComponent(data.account)}${week ? `&week=${week.date}` : ''}`);
    this.root.innerHTML = this.headingHtml('A year of Fridays.', 'Closing positions, portfolio performance, and the trades in between.', `<label>Year<select data-filter="year" aria-label="Year">${data.years.map(y => `<option ${y === this.year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>${this.accountFilterHtml(data.accounts)}`) + `
      <div class="fl-layout"><aside class="fl-calendar" aria-label="Friday calendar"><div class="fl-calendar-title">${data.year}<small>${count} completed Fridays</small></div>
      ${this.months.map((month, index) => `<div class="fl-month"><span>${month}</span>${data.weeks.filter(w => Number(w.date.slice(5, 7)) === index + 1).map(w => `<button class="fl-day ${this.tone(w.weekPct)} ${w.date === this.selected ? 'selected' : ''} ${w.tradeCount && !w.upcoming ? 'has-trades' : ''}" data-week="${w.date}" ${w.upcoming ? 'disabled' : ''} aria-pressed="${w.date === this.selected}" aria-label="${this.date(w.date, true)}, ${w.upcoming ? 'upcoming' : `portfolio ${this.percent(w.weekPct)}`}" title="${this.date(w.date)} · ${w.upcoming ? 'Upcoming' : this.percent(w.weekPct)}">${Number(w.date.slice(8))}${!w.upcoming && Number.isFinite(w.weekPct) ? `<span class="fl-move-bar" aria-hidden="true" style="width:${maxMove ? Math.abs(w.weekPct) / maxMove * 100 : 0}%"></span>` : ''}</button>`).join('')}</div>`).join('')}
      <p class="fl-calendar-key">Bar length = weekly move size<br><span class="fl-up">Green: gain</span> / <span class="fl-down">Red: loss</span>${largest ? `<br><strong>Full width: ${maxMove.toFixed(2)}%</strong> (${this.date(largest.date)})` : ''}<br>&bull; Stock trades &nbsp; &#9633; Selected Friday<br>Uncolored: return pending. Dimmed: upcoming.</p></aside>
      <section class="fl-week" aria-live="polite">${week ? this.weekHtml(week) : '<p class="fl-notice">The first Friday snapshot will appear after the week closes.</p>'}</section></div>
      <details class="fl-records"><summary>Sources & updates</summary><p>${data.anchor ? `Reconstructed from ${this.escape(data.anchor.source)}.` : 'Account holdings are pending a dated account balance. The combined portfolio is available under All accounts.'} Transactions through ${this.escape(data.coverage || 'not imported')}. Closing prices: Yahoo Finance${data.pricesUpdatedAt ? `, refreshed ${this.date(data.pricesUpdatedAt.slice(0, 10))}` : ''}.</p>
      ${data.reconciliation ? `<p>Opening balance check: reconstructed ${this.money(data.reconciliation.openingValue, 2)}; dashboard starting value ${this.money(data.reconciliation.reportedOpeningValue, 2)}. Difference: ${this.money(data.reconciliation.difference, 2)}. These are reconstructed records, not reconciled brokerage statements.</p>` : ''}
      <p>Weekly return uses <a href="https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/" target="_blank" rel="noopener">Modified Dietz</a> with day-end deposits and withdrawals. Cash, money-market funds, dividends and fees are included. Stock week % measures price change, adjusted for splits. A market holiday uses the last trading close; the first 2026 portfolio period starts December 31.</p>
      <p>Friday balances are captured after 6 p.m. New York time while the server is running. Returns finalize when recorded holdings and cash match that Friday’s Google Sheet snapshot. If they differ, import updated transactions. Missed snapshots can be reconstructed from complete exports. Import each account’s full history since January 1, 2026; overlapping exports are deduplicated.</p>
      ${data.canManage ? `<button data-action="refresh">Refresh closing prices</button><form class="fl-import"><label>Account<select name="account" required><option value="">Choose account</option>${Object.entries(data.accounts).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select></label><label>Export through<input name="through" type="date" min="2026-01-01" required></label><label>Schwab transactions<input name="file" type="file" accept=".csv,text/csv" required></label><button type="submit">Import CSV</button></form><p class="fl-update-message" role="status"></p>` : ''}</details>`;
  },

  /** Render the headline performance, allocation, positions and full weekly activity ledger. */
  weekHtml(week) {
    const complete = this.data.weeks.filter(w => !w.upcoming), index = complete.findIndex(w => w.date === week.date);
    const issues = week.issues.length ? `<p class="fl-notice">${week.issues.map(i => this.escape(i)).join(' ')}</p>` : '';
    // Keep deposits and withdrawals visible even when they offset within the week.
    const transfers = week.transactions.filter(t => t.action === 'MoneyLink Transfer');
    let deposits = transfers.reduce((sum, t) => sum + Math.max(0, t.amount || 0), 0);
    let withdrawals = transfers.reduce((sum, t) => sum + Math.max(0, -(t.amount || 0)), 0);
    // Include net journal transfers while allowing internal account transfers to cancel.
    const otherFlows = (week.externalFlows || 0) - (deposits - withdrawals);
    if (otherFlows > 0.005) deposits += otherFlows;
    if (otherFlows < -0.005) withdrawals -= otherFlows;
    const flowDetails = [deposits > 0.005 ? `${this.money(deposits)} deposited` : '',
      withdrawals > 0.005 ? `${this.money(withdrawals)} withdrawn` : ''].filter(Boolean).join(', ');
    const gainLabel = flowDetails ? `flow-adjusted (${flowDetails})` : week.profit < 0 ? 'loss' : 'gain';
    const cashWeight = week.total > 0 ? Math.max(0, week.cash / week.total * 100) : 0;
    const allocation = week.holdings.filter(h => h.weight > 0).slice(0, 8).map(h => ({ symbol: h.symbol, weight: h.weight }));
    const other = week.holdings.filter(h => h.weight > 0).slice(8).reduce((n, h) => n + h.weight, 0);
    if (other) allocation.push({ symbol: 'Other', weight: other });
    if (cashWeight) allocation.push({ symbol: 'Cash', weight: cashWeight });
    const colors = ['#b6cddd', '#829fae', '#638779', '#9ca782', '#b4a28d', '#877b98', '#666d78', '#a38181', '#535b61', '#444'];
    return `<div class="fl-week-title"><div><h2>Friday, ${this.date(week.date, true)}</h2><p>${this.date(week.periodStart)} close to ${this.date(week.date)} close · ${this.escape(this.data.accounts[this.account] || 'All 4 accounts')} · ${week.balancesMatch === true ? 'Matched to Google Sheet' : week.source === 'captured' ? 'Captured' : 'Reconstructed'}</p></div><div class="fl-arrows"><button data-step="-1" ${index <= 0 ? 'disabled' : ''} aria-label="Previous Friday">←</button><button data-step="1" ${index === complete.length - 1 ? 'disabled' : ''} aria-label="Next Friday">→</button></div></div>
      <div class="fl-stats"><div><small>PORTFOLIO AT CLOSE</small><strong>${this.money(week.total)}</strong><p>${week.holdings.length} positions · includes cash</p></div><div><small>PORTFOLIO THIS WEEK</small><strong class="${this.tone(week.weekPct)}">${this.percent(week.weekPct)}</strong><p>${week.profit === null ? 'Awaiting complete data' : `${this.money(week.profit)} · ${gainLabel}`}</p></div><div><small>PORTFOLIO YTD</small><strong class="${this.tone(week.ytdPct)}">${this.percent(week.ytdPct)}</strong><p>${week.ytdPct == null ? 'History incomplete' : `Since Dec 31, ${this.year - 1}`}</p></div><div><small>STOCK TRADES</small><strong>${week.tradeCount}</strong><p>${week.transactions.length} total activities</p></div></div>${issues}
      ${allocation.length ? `<div class="fl-section-title"><h3>What you owned</h3><span>Share of portfolio value</span></div><div class="fl-allocation" aria-label="Portfolio allocation">${allocation.map((a, i) => `<span style="width:${a.weight}%;background:${colors[i % colors.length]}" title="${a.symbol}: ${a.weight.toFixed(1)}%"></span>`).join('')}</div><div class="fl-allocation-labels">${allocation.map((a, i) => `<span><i style="background:${colors[i % colors.length]}"></i>${this.escape(a.symbol)} ${a.weight.toFixed(1)}%</span>`).join('')}</div>` : ''}
      <div class="fl-section-title"><h3>Positions at close</h3><span>Click a ticker for weekly detail</span></div><div class="fl-table-wrap"><table><thead><tr><th>Holding</th><th>Shares</th><th>Closing price</th><th>Stock week %</th><th>Market value</th><th>Weight</th><th>Activity</th></tr></thead><tbody>
      ${week.holdings.map(h => this.holdingHtml(h, week)).join('')}
      ${week.cash !== null ? `<tr><td>Cash & equivalents<small>Includes SWVXX</small></td><td></td><td></td><td></td><td>${this.money(week.cash)}</td><td>${week.total > 0 ? (week.cash / week.total * 100).toFixed(1) + '%' : 'Pending'}</td><td></td></tr>` : ''}
      </tbody></table></div>${!week.holdings.length ? '<p class="fl-empty">No verified positions available for this account and date.</p>' : ''}
      <div class="fl-section-title"><h3>This week’s transactions</h3><span>Trades, income & transfers</span></div>${this.transactionsHtml(week.transactions)}
      <p class="fl-footnote">${week.externalFlows ? `Net external flows: ${this.money(week.externalFlows)}. ` : ''}Closing prices use the final trading session on or before Friday.</p>`;
  },

  /** Compound weekly moves into one period return; missing weeks count as flat. */
  compound(moves) { return (moves.reduce((n, v) => n * (1 + (v || 0) / 100), 1) - 1) * 100; },

  /** Compare the latest weeks with the same number of weeks before them (4 vs 4 once nine Fridays exist). */
  momentum(moves) {
    const n = moves.length, k = Math.min(4, Math.floor(n / 2));
    const recent = this.compound(moves.slice(n - k)), prior = this.compound(moves.slice(n - 2 * k, n - k));
    return { recent, prior, score: recent - prior, split: (n - k) / n };
  },

  /** Momentum view: shares the Fridays data (same year and account filters) and shows only the tape. */
  drawMomentum() {
    const data = this.data;
    history.replaceState(null, '', `#friday-log?view=momentum&year=${data.year}&account=${encodeURIComponent(data.account)}`);
    const years = `<label>Year<select data-filter="year" aria-label="Year">${data.years.map(y => `<option ${y === this.year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>`;
    this.root.innerHTML = this.headingHtml('Speeding up, or fading.', 'How each stock moved, week by week, over the last nine Fridays.', years + this.accountFilterHtml(data.accounts))
      + (this.momentumHtml() || '<p class="fl-notice">Momentum needs at least five completed Fridays in the selected year.</p>');
  },

  /** Render the momentum tape: one panel per stock, weekly bars on a shared scale, sorted by acceleration. */
  momentumHtml() {
    const m = this.data.momentum;
    if (!m || m.weeks.length < 5) return '';
    const last = m.weeks.length - 1;
    const stocks = m.stocks.map(s => ({ ...s, score: this.momentum(s.pct).score })).sort((a, b) => b.score - a.score);
    const current = stocks.filter(s => s.held[last]), exited = stocks.filter(s => !s.held[last]);
    const k = Math.min(4, Math.floor(m.weeks.length / 2));
    const group = (label, note, panels) => `<div class="fl-tape-group"><span>${label}</span><span>${note}</span></div><div class="fl-tape">${panels}</div>`;
    const exitNote = s => { const i = s.held.lastIndexOf(true); return i >= 0 ? `held ${this.date(m.weeks[i])}` : 'traded'; };
    return `<section class="fl-momentum"><div class="fl-section-title"><div><p>Last ${k} weeks against the ${k} before. Weekly price moves, ${this.date(m.weeks[0])} to ${this.date(m.weeks[last])}.</p></div>
      <div class="fl-toggle"><button data-momentum="held" aria-pressed="${!this.momentumAll}">Current holdings</button><button data-momentum="all" aria-pressed="${this.momentumAll}">Include exited</button></div></div>
      ${group('BENCHMARKS', '', this.panelHtml('Portfolio', this.account === 'all' ? 'all accounts' : this.data.accounts[this.account], m.portfolio, null, null, true) + this.panelHtml('SPY', 'S&P 500', m.spy))}
      ${current.length ? group('HOLDINGS · FASTEST FIRST', 'weight', current.map(s => this.panelHtml(s.symbol, s.weight[last] == null ? '' : s.weight[last].toFixed(1) + '%', s.pct, s.held, s.trades)).join('')) : ''}
      ${this.momentumAll && exited.length ? group('EXITED · FASTEST FIRST', 'last held', exited.map(s => this.panelHtml(s.symbol, exitNote(s), s.pct, s.held, s.trades)).join('')) : ''}
      <p class="fl-tape-key"><span class="fl-acc">↗</span> speeding up by 5+ points. <span class="fl-fade">↘</span> fading by 5+. Faded bars: not held that week. Notched bars ran past ±25%. <span class="fl-up">▲</span> buy <span class="fl-down">▼</span> sell.</p></section>`;
  },

  /** Render one tape panel with its total, acceleration arrow, weekly bars and trade marks. */
  panelHtml(symbol, note, moves, held, trades, benchmark = false) {
    const CAP = 25, m = this.momentum(moves), total = moves.some(Number.isFinite) ? this.compound(moves) : null;
    const [arrow, tone] = m.score > 5 ? ['↗', 'fl-acc'] : m.score < -5 ? ['↘', 'fl-fade'] : ['→', 'fl-flat'];
    const bars = moves.map((v, i) => {
      const label = `${symbol} · week of ${this.date(this.data.momentum.weeks[i])}: ${this.percent(v)}${held && !held[i] ? ' (not held)' : ''}`;
      if (!Number.isFinite(v)) return `<span title="${this.escape(label)}"></span>`;
      // Shared ±25% scale keeps panels comparable; bigger moves are clipped and notched.
      const height = Math.max(Math.min(Math.abs(v), CAP) / CAP * 50, .8);
      return `<span class="${held && !held[i] ? 'out' : ''} ${Math.abs(v) > CAP ? 'clip' : ''} ${v >= 0 ? 'pos' : 'neg'}" title="${this.escape(label)}"><i style="${v >= 0 ? 'bottom' : 'top'}:50%;height:${height}%"></i></span>`;
    }).join('');
    const marks = moves.map((v, i) => { const t = trades?.[i]; return `<span class="${t || ''}">${t === 'B' ? '▲' : t === 'S' ? '▼' : t ? '◆' : ''}</span>`; }).join('');
    const columns = `grid-template-columns:repeat(${moves.length},1fr)`;
    return `<div class="fl-panel ${benchmark ? 'benchmark' : ''}"><div class="fl-panel-top"><b>${this.escape(symbol)}</b><small>${this.escape(note)}</small><span class="${tone}" title="Last weeks ${this.percent(m.recent)} vs prior ${this.percent(m.prior)}">${arrow}</span></div>
      <strong class="${this.tone(total)}">${this.percent(total, 1)}</strong><p>${this.percent(m.recent, 1)} vs ${this.percent(m.prior, 1)}</p>
      <div class="fl-bars" style="${columns};--split:${m.split * 100}%">${bars}</div><div class="fl-marks" style="${columns}">${marks}</div></div>`;
  },

  /** Keep a stock's position and its underlying weekly activity together. */
  holdingHtml(holding, week) {
    const h = holding, activity = week.transactions.filter(t => t.symbol === h.symbol);
    return `<tr><td><button class="fl-ticker" data-symbol="${this.escape(h.symbol)}" aria-expanded="${this.expanded === h.symbol}">${this.escape(h.symbol)} <span>${this.expanded === h.symbol ? '−' : '+'}</span></button><small>${this.escape(h.name)}</small></td><td>${h.shares.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td><td>${this.money(h.close, 2)}${h.closeDate && h.closeDate !== week.date ? `<small>${this.date(h.closeDate)}</small>` : ''}</td><td class="${this.tone(h.weekPct)}">${this.percent(h.weekPct)}</td><td>${this.money(h.value)}</td><td>${h.weight === null ? 'Pending' : h.weight.toFixed(1) + '%'}</td><td>${activity.length ? `<button class="fl-activity-link" data-symbol="${this.escape(h.symbol)}">${activity.length} ${activity.length === 1 ? 'activity' : 'activities'} ↗</button>` : '<span class="fl-muted">No trades</span>'}</td></tr>
      ${this.expanded === h.symbol ? `<tr class="fl-stock-detail"><td colspan="7"><p>${this.escape(h.symbol)} · Previous weekly close ${this.money(h.previousClose, 2)} → ${this.money(h.close, 2)} · <span class="${this.tone(h.weekPct)}">${this.percent(h.weekPct)}</span></p>${this.transactionsHtml(activity)}</td></tr>` : ''}`;
  },

  /** Render every activity, including stocks sold out before Friday and non-trade cash events. */
  transactionsHtml(transactions) {
    if (!transactions.length) return '<p class="fl-empty">No transactions this week.</p>';
    return `<div class="fl-table-wrap"><table class="fl-transactions"><thead><tr><th>Date</th><th>Account</th><th>Activity</th><th>Symbol</th><th>Shares</th><th>Trade price</th><th>Amount</th></tr></thead><tbody>${[...transactions].reverse().map(t => `<tr><td>${this.date(t.date)}</td><td>${this.escape(this.accountName(t.account))}</td><td class="${t.action === 'Buy' ? 'fl-up' : t.action === 'Sell' ? 'fl-down' : ''}">${this.escape(t.action)}</td><td>${this.escape(t.symbol)}</td><td>${t.quantity === null ? '' : t.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td><td>${t.price === null ? '' : this.money(t.price, 2)}</td><td>${t.amount === null ? '' : this.money(t.amount, 2)}</td></tr>`).join('')}</tbody></table></div>`;
  },

  /** Render trade statistics: overall tiles, breakdowns, and either the stock table or one stock's detail. */
  drawTrades() {
    const t = this.trades, o = t.overall;
    history.replaceState(null, '', `#friday-log?view=trades&account=${encodeURIComponent(t.account)}${this.period !== 'ytd' ? `&period=${this.period}` : ''}${this.type !== 'all' ? `&type=${this.type}` : ''}${this.symbol ? `&symbol=${this.symbol}` : ''}`);
    const span = `${this.date(t.from, true)} to ${this.date(t.to, true)}`;
    const lookup = `<form class="fl-lookup" role="search"><label>Stock lookup<input name="symbol" data-lookup list="fl-symbols" autocomplete="off" spellcheck="false" placeholder="Ticker, e.g. ${this.escape(t.symbols[0]?.symbol || 'ALAB')}" value="${this.escape(this.query)}" aria-label="Ticker lookup"></label><datalist id="fl-symbols">${t.symbols.map(s => `<option value="${this.escape(s.symbol)}">${this.escape(s.name)}</option>`).join('')}</datalist><button type="submit">Look up</button>${this.symbol ? '<button type="button" data-action="clear-symbol">All stocks</button>' : ''}<span class="fl-lookup-message" role="status"></span></form>`;
    const stock = this.symbol ? t.symbols.find(s => s.symbol === this.symbol) : null;
    this.root.innerHTML = this.headingHtml('Every trade, tallied.', `Realized results, open positions, and a lookup for any ticker you have traded. Showing ${span}.`, this.periodFilterHtml(t) + this.typeFilterHtml() + this.accountFilterHtml(t.accounts))
      + lookup + (stock ? this.stockHtml(stock) : this.overviewHtml(t, o))
      + `<details class="fl-records"><summary>Method & sources</summary><p>${this.escape(t.method)} Sells, buys and income are counted from ${this.date(t.from, true)} through ${this.date(t.to, true)}; lots come from the whole ledger, so a sale is judged against what the shares really cost. Realized gain % compares proceeds with the cost of the shares sold; unrealized values open shares at the last close on or before the period end${t.pricesUpdatedAt ? ` (quotes refreshed ${this.date(t.pricesUpdatedAt.slice(0, 10))})` : ''}. Average buy is the cost of the shares sold, or the lot cost of an unsold position; average sell is proceeds divided by shares sold. Option contracts count as 100 shares each. Wins and losses are whole positions, judged only once every share is sold, so a trim is not a result on its own; a position that exits in this period counts here even if earlier trims fell in another period. Transactions on record from ${this.escape(t.ledgerStart || 'none')} through ${this.escape(t.coverage || 'not imported')}. ${this.account === 'all' ? 'The combined view unwinds the balance reference through every recorded trade to find the shares held on the first day.' : 'An individual account has no dated balance reference, so shares sold beyond its recorded purchases are priced at the first day\'s close.'}</p></details>`;
  },

  /** Headline statistics and the breakdown tables for the whole ledger. */
  overviewHtml(t, o) {
    const tile = (label, value, note, tone = '') => `<div><small>${label}</small><strong class="${tone}">${value}</strong><p>${note}</p></div>`;
    const stats = `<div class="fl-stats fl-stats-grid">
      ${tile('REALIZED GAIN', this.gain(o.realized), `${this.percent(o.realizedPct)} on shares sold · ${o.sells} sells`, this.tone(o.realized))}
      ${tile('UNREALIZED GAIN', this.gain(o.unrealized), `${this.percent(o.unrealizedPct)} on ${this.money(o.openCost)} open cost · ${o.open} positions`, this.tone(o.unrealized))}
      ${tile('WIN RATE', o.winRate === null ? 'Pending' : `${o.winRate.toFixed(0)}%`, `${o.wins} wins · ${o.losses} losses${o.unknown ? ` · ${o.unknown} unknown` : ''} · ${o.positions} positions fully sold`)}
      ${tile('AVERAGE WIN / LOSS', `<span class="fl-up">${this.percent(o.avgWinPct)}</span> <span class="fl-muted">/</span> <span class="fl-down">${this.percent(o.avgLossPct)}</span>`, `${this.gain(o.avgWin)} / ${this.gain(o.avgLoss)} per position`)}
      ${tile('PROFIT FACTOR', o.profitFactor === null ? 'Pending' : o.profitFactor.toFixed(2), 'Gross wins ÷ gross losses on positions')}
      ${tile('HOLD TIME', o.avgHoldDays === null ? 'Pending' : `${o.avgHoldDays} days`, o.avgWinHoldDays === null && o.avgLossHoldDays === null ? 'First buy to final exit' : `Wins ${o.avgWinHoldDays ?? '–'} · losses ${o.avgLossHoldDays ?? '–'} days`)}
      ${tile('BOUGHT / SOLD', `${this.money(o.invested)} <span class="fl-muted">/</span> ${this.money(o.proceeds)}`, `${o.buys} buys · ${o.sells} sells · ${o.symbols} stocks`)}
      ${tile('INCOME & COSTS', this.money(o.dividends + o.interest, 2), `Dividends ${this.money(o.dividends, 2)} · interest ${this.money(o.interest, 2)} · fees ${this.money(o.fees, 2)}`)}
    </div>`;
    const stockLink = symbol => `<button class="fl-activity-link" data-lookup-symbol="${this.escape(symbol)}">${this.escape(symbol)}</button>`;
    const closed = (label, x) => x ? `<span>${label} ${stockLink(x.symbol)} <b class="${this.tone(x.realizedPct)}">${this.percent(x.realizedPct)} · ${this.gain(x.realized)}</b> <i>avg buy ${this.money(x.avgBuyPrice, 2)} → avg sell ${this.money(x.avgSellPrice, 2)}</i></span>` : '';
    const open = (label, x) => x ? `<span>${label} ${stockLink(x.symbol)} <b class="${this.tone(x.unrealizedPct)}">${this.percent(x.unrealizedPct)} · ${this.gain(x.unrealized)}</b> <i>since ${this.date(x.heldSince)}</i></span>` : '';
    const extremes = `<div class="fl-extremes"><div><small>SOLD OUT · ranked by % return on the whole position</small>${closed('Best', o.bestClosed)}${closed('Worst', o.worstClosed)}${!o.bestClosed ? '<span class="fl-muted">No position fully sold yet.</span>' : ''}</div><div><small>STILL HELD · unrealized % on open shares</small>${open('Largest winner', o.bestOpen)}${open('Largest loser', o.worstOpen)}${!o.bestOpen ? '<span class="fl-muted">No open positions.</span>' : ''}</div></div>`;
    const sorts = { recent: 'Recent activity', realizedPct: 'Realized %', realized: 'Realized $', unrealizedPct: 'Unrealized %', unrealized: 'Unrealized $', invested: 'Amount bought', symbol: 'Ticker' };
    const breakdown = rows => rows.map(r => `<tr><td>${this.escape(r.label)}</td><td>${r.symbols}</td><td>${r.buys}</td><td>${r.sells}</td><td>${this.money(r.invested)}</td><td>${this.money(r.proceeds)}</td><td>${r.wins}–${r.losses}</td><td class="${this.tone(r.realized)}">${this.gain(r.realized)}</td></tr>`).join('');
    const breakdownHead = first => `<thead><tr><th>${first}</th><th>Stocks</th><th>Buys</th><th>Sells</th><th>Bought</th><th>Sold</th><th>W–L</th><th>Realized</th></tr></thead>`;
    return `${stats}${extremes}
      <div class="fl-section-title"><h3>By stock</h3><label class="fl-sort">Sort<select data-filter="sort">${Object.entries(sorts).map(([k, v]) => `<option value="${k}" ${this.sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="fl-table-wrap"><table class="fl-symbol-table"><thead><tr><th>Stock</th><th>Status</th><th>Buys / sells</th><th>Avg buy</th><th>Avg sell</th><th>Bought</th><th>Sold</th><th>Realized</th><th>Realized %</th><th>Open shares</th><th>Last close</th><th>Unrealized</th><th>Unrealized %</th><th>First</th><th>Last</th></tr></thead><tbody>${this.symbolRowsHtml()}</tbody></table></div>
      <div class="fl-section-title"><h3>By month</h3><span>When the buying and selling happened</span></div><div class="fl-table-wrap"><table>${breakdownHead('Month')}<tbody>${breakdown(t.byMonth.map(r => ({ ...r, label: new Date(`${r.key}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) })))}</tbody></table></div>
      ${t.byType?.length > 1 ? `<div class="fl-section-title"><h3>Stocks vs options</h3><span>Use the Type filter to view either on its own</span></div><div class="fl-table-wrap"><table>${breakdownHead('Type')}<tbody>${breakdown(t.byType)}</tbody></table></div>` : ''}
      ${t.byAccount.length ? `<div class="fl-section-title"><h3>By account</h3><span>Journaled shares stay with their receiving account</span></div><div class="fl-table-wrap"><table>${breakdownHead('Account')}<tbody>${breakdown(t.byAccount)}</tbody></table></div>` : ''}`;
  },

  /** Rows for the stock table, filtered by the lookup text and ordered by the chosen sort. */
  symbolRowsHtml() {
    const q = this.query.trim().toUpperCase();
    const desc = key => (a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity);
    const order = { recent: (a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''), realized: desc('realized'), realizedPct: desc('realizedPct'),
      unrealized: desc('unrealized'), unrealizedPct: desc('unrealizedPct'), invested: (a, b) => b.invested - a.invested, symbol: (a, b) => a.symbol.localeCompare(b.symbol) };
    const rows = this.trades.symbols.filter(s => !q || s.symbol.includes(q) || s.name.toUpperCase().includes(q)).sort(order[this.sort] || order.recent);
    if (!rows.length) return `<tr><td colspan="15" class="fl-empty">No traded stock matches “${this.escape(this.query)}”.</td></tr>`;
    return rows.map(s => `<tr><td><button class="fl-ticker" data-lookup-symbol="${this.escape(s.symbol)}">${this.escape(s.symbol)} <span>↗</span></button><small>${this.escape(s.name)}</small></td><td>${s.status === 'open' ? 'Open' : '<span class="fl-muted">Closed</span>'}</td><td>${s.buys} / ${s.sells}</td><td>${this.money(s.avgBuyPrice, 2)}</td><td>${s.sells ? this.money(s.avgSellPrice, 2) : ''}</td><td>${this.money(s.invested)}</td><td>${this.money(s.proceeds)}</td><td class="${this.tone(s.realized)}">${s.sells ? this.gain(s.realized) : '<span class="fl-muted">–</span>'}</td><td class="${this.tone(s.realizedPct)}">${s.sells ? this.percent(s.realizedPct) : ''}</td><td>${s.openShares > 0 ? this.shares(s.openShares) : ''}</td><td>${s.openShares > 0 ? this.money(s.lastClose, 2) : ''}</td><td class="${this.tone(s.unrealized)}">${s.openShares > 0 ? this.gain(s.unrealized) : ''}</td><td class="${this.tone(s.unrealizedPct)}">${s.openShares > 0 ? this.percent(s.unrealizedPct) : ''}</td><td>${this.date(s.firstDate || s.heldSince)}</td><td>${this.date(s.lastDate || s.heldSince)}</td></tr>`).join('');
  },

  /** One stock: summary tiles, each sell with its FIFO lots, and every ledger line for the ticker. */
  stockHtml(s) {
    const tile = (label, value, note, tone = '') => `<div><small>${label}</small><strong class="${tone}">${value}</strong><p>${note}</p></div>`;
    return `<div class="fl-week-title fl-stock-title"><div><h2>${this.escape(s.symbol)} <small>${this.escape(s.name)}</small></h2><p>${s.status === 'open' ? `Open since ${this.date(s.heldSince, true)}` : `Closed · last activity ${this.date(s.lastDate, true)}`} · ${s.accounts.map(a => this.escape(this.accountName(a))).join(', ')}${s.openingShares ? ` · ${this.shares(s.openingShares)} shares held before ${this.date(this.trades.openingDate, true)} priced at that close` : ''}</p></div></div>
      <div class="fl-stats fl-stats-grid">
      ${tile('REALIZED GAIN', s.sells ? this.gain(s.realized) : 'None yet', s.sells ? `${this.percent(s.realizedPct)} on ${this.money(s.proceeds)} sold` : 'Nothing sold', this.tone(s.realized))}
      ${tile('UNREALIZED GAIN', s.openShares > 0 ? this.gain(s.unrealized) : 'Closed out', s.openShares > 0 ? `${this.percent(s.unrealizedPct)} · ${this.shares(s.openShares)} shares at ${this.money(s.lastClose, 2)}${s.lastCloseDate ? ` (${this.date(s.lastCloseDate)})` : ''}` : 'No open shares', this.tone(s.unrealized))}
      ${tile('AVERAGE BUY', this.money(s.avgBuyPrice, 2), s.sells ? `Cost of the ${this.shares(s.sharesSold)} shares sold · ${s.buys} buys this period` : `Cost of the ${this.shares(s.openShares)} shares held · ${s.buys} buys this period`)}
      ${tile('AVERAGE SELL', s.sells ? this.money(s.avgSellPrice, 2) : '–', s.sells ? `${this.shares(s.sharesSold)} shares over ${s.sells} sells` : 'Nothing sold yet')}
      ${tile('STILL HELD', s.openShares > 0 ? `${this.shares(s.openShares)} <span class="fl-muted">shares</span>` : '–', s.openShares > 0 ? `avg cost ${this.money(s.avgCost, 2)} · ${this.money(s.openCost)} cost · worth ${this.money(s.marketValue)}` : 'No open shares')}
      ${tile('BOUGHT / SOLD', `${this.money(s.invested)} <span class="fl-muted">/</span> ${this.money(s.proceeds)}`, `${s.dividends ? `${this.money(s.dividends, 2)} in dividends · ` : ''}${this.date(s.firstDate || s.heldSince)} to ${this.date(s.lastDate || s.heldSince)}`)}
      </div>
      <details class="fl-records"><summary>Every transaction for ${this.escape(s.symbol)} (${s.transactions.length})</summary>${this.transactionsHtml(s.transactions)}</details>`;
  },

  /** Jump to one stock's detail from any ticker button; a ticker outside the period is looked up across all time. */
  async select(symbol) {
    let found = this.trades?.symbols.find(s => s.symbol === symbol);
    if (!found && (this.period !== 'all' || this.type !== 'all') && this.trades?.symbols) {
      this.period = 'all'; this.type = 'all'; this.symbol = symbol; this.query = symbol; await this.loadTrades();
      found = this.trades?.symbols.find(s => s.symbol === symbol);
    }
    if (!found) { const message = this.root?.querySelector('.fl-lookup-message'); if (message) message.textContent = `No trades found for ${symbol}.`; return; }
    this.symbol = found.symbol; this.query = found.symbol; this.draw(); window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /** Filter the stock table as the lookup text changes without rebuilding the input mid-keystroke. */
  input(event) {
    if (!event.target.matches('[data-lookup]')) return;
    this.query = event.target.value;
    const body = this.root.querySelector('.fl-symbol-table tbody');
    if (body) body.innerHTML = this.symbolRowsHtml();
  },

  /** Navigate Fridays, expand positions and refresh prices using delegated controls. */
  async click(event) {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.view) {
      if (button.dataset.view === this.view) return;
      this.view = button.dataset.view; this.expanded = null; await this.load();
    } else if (button.dataset.lookupSymbol) await this.select(button.dataset.lookupSymbol);
    else if (button.dataset.action === 'clear-symbol') { this.symbol = null; this.query = ''; this.draw(); }
    else if (button.dataset.week) {
      this.selected = button.dataset.week; this.expanded = null; this.draw();
      if (window.matchMedia('(max-width:760px)').matches) this.root.querySelector('.fl-week').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    else if (button.dataset.step) {
      const weeks = this.data.weeks.filter(w => !w.upcoming), i = weeks.findIndex(w => w.date === this.selected);
      this.selected = weeks[i + Number(button.dataset.step)]?.date || this.selected; this.expanded = null; this.draw();
    } else if (button.dataset.symbol) { this.expanded = this.expanded === button.dataset.symbol ? null : button.dataset.symbol; this.draw(); }
    else if (button.dataset.momentum) { this.momentumAll = button.dataset.momentum === 'all'; this.draw(); }
    else if (button.dataset.action === 'retry') await this.load();
    else if (button.dataset.action === 'refresh') {
      const token = this.request; button.disabled = true; button.textContent = 'Refreshing…';
      try { await API._requestJson('/api/friday-log/refresh', { method: 'POST' }); if (this.root && token === this.request) await this.load(); }
      catch (error) { if (this.root && token === this.request) this.root.querySelector('.fl-update-message').textContent = error.message; }
      finally { button.disabled = false; button.textContent = 'Refresh closing prices'; }
    }
  },

  /** Reload the correct year or account without stale values flashing in the selected view. */
  async change(event) {
    if (event.target.dataset.filter === 'year') { this.year = Number(event.target.value); this.selected = null; await this.load(); }
    if (event.target.dataset.filter === 'account') { this.account = event.target.value; await this.load(); }
    if (event.target.dataset.filter === 'period') { this.period = event.target.value; await this.load(); }
    if (event.target.dataset.filter === 'type') { this.type = event.target.value; await this.load(); }
    if (event.target.dataset.filter === 'sort') { this.sort = event.target.value; const body = this.root.querySelector('.fl-symbol-table tbody'); if (body) body.innerHTML = this.symbolRowsHtml(); }
  },

  /** Import one account's full export with an explicit coverage date and visible error feedback. */
  async import(event) {
    if (event.target.matches('.fl-lookup')) { event.preventDefault(); await this.select(this.query.trim().toUpperCase()); return; }
    if (!event.target.matches('.fl-import')) return;
    event.preventDefault(); const form = event.target, button = form.querySelector('button'), token = this.request;
    button.disabled = true; button.textContent = 'Importing…';
    try {
      await API._requestJson('/api/friday-log/import', { method: 'POST', body: new FormData(form) });
      if (this.root && token === this.request) await this.load();
    } catch (error) { if (this.root && token === this.request) this.root.querySelector('.fl-update-message').textContent = error.message; }
    finally { button.disabled = false; button.textContent = 'Import CSV'; }
  },
};
