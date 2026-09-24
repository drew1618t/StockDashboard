/** Year Atlas: private Friday snapshots backed by the transaction ledger and historical closes. */
const FridayLogDashboard = {
  root: null, data: null, selected: null, account: 'all', year: null, expanded: null, request: 0,
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  /** Escape all source and API text before interpolating HTML. */
  escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  /** Display unavailable data explicitly rather than turning it into a zero. */
  money(value, decimals = 0) { return value === null || value === undefined ? 'Pending' : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }); },

  /** Format a signed portfolio or security return. */
  percent(value) { return value === null || value === undefined ? 'Pending' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; },

  /** Keep Friday labels independent of the browser's timezone. */
  date(value, long = false) { return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: long ? 'long' : 'short', day: 'numeric', ...(long ? { year: 'numeric' } : {}), timeZone: 'UTC' }); },

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
    this.root.addEventListener('click', event => this.click(event), { signal: this.controller.signal });
    this.root.addEventListener('change', event => this.change(event), { signal: this.controller.signal });
    this.root.addEventListener('submit', event => this.import(event), { signal: this.controller.signal });
    await this.load();
  },

  /** Cancel event handlers and prevent late responses from painting into another dashboard. */
  destroy() { this.request++; this.controller?.abort(); this.root = null; document.body.classList.remove('friday-active'); },

  /** Fetch uncached snapshots and guard against out-of-order account/year responses. */
  async load() {
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

  /** Render the approved calendar and week-detail composition. */
  draw() {
    if (!this.root) return;
    const data = this.data, week = data.weeks.find(w => w.date === this.selected);
    const count = data.weeks.filter(w => !w.upcoming).length;
    history.replaceState(null, '', `#friday-log?year=${data.year}&account=${encodeURIComponent(data.account)}${week ? `&week=${week.date}` : ''}`);
    this.root.innerHTML = `<div class="fl-heading"><div><div class="fl-eyebrow">FRIDAY LOG</div><h1>A year of Fridays.</h1><p>Closing positions, portfolio performance, and the trades in between.</p></div><div class="fl-filters"><label>Year<select data-filter="year" aria-label="Year">${data.years.map(y => `<option ${y === this.year ? 'selected' : ''}>${y}</option>`).join('')}</select></label><label>Account<select data-filter="account" aria-label="Account"><option value="all">All accounts</option>${Object.entries(data.accounts).map(([id, name]) => `<option value="${id}" ${this.account === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label></div></div>
      <div class="fl-layout"><aside class="fl-calendar" aria-label="Friday calendar"><div class="fl-calendar-title">${data.year}<small>${count} completed Fridays</small></div>
      ${this.months.map((month, index) => `<div class="fl-month"><span>${month}</span>${data.weeks.filter(w => Number(w.date.slice(5, 7)) === index + 1).map(w => `<button class="fl-day ${this.tone(w.weekPct)} ${w.date === this.selected ? 'selected' : ''} ${w.tradeCount && !w.upcoming ? 'has-trades' : ''}" data-week="${w.date}" ${w.upcoming ? 'disabled' : ''} aria-pressed="${w.date === this.selected}" aria-label="${this.date(w.date, true)}, ${w.upcoming ? 'upcoming' : `portfolio ${this.percent(w.weekPct)}`}" title="${this.date(w.date)} · ${w.upcoming ? 'Upcoming' : this.percent(w.weekPct)}">${Number(w.date.slice(8))}</button>`).join('')}</div>`).join('')}
      <p class="fl-calendar-key"><span class="fl-up">Green</span> / <span class="fl-down">red</span>: portfolio’s weekly return<br>• Stock trades &nbsp; □ Selected Friday<br>Uncolored: return pending. Dimmed: upcoming.</p></aside>
      <section class="fl-week" aria-live="polite">${week ? this.weekHtml(week) : '<p class="fl-notice">The first Friday snapshot will appear after the week closes.</p>'}</section></div>
      <details class="fl-records"><summary>Sources & updates</summary><p>${data.anchor ? `Reconstructed from ${this.escape(data.anchor.source)}.` : 'Account holdings are pending a dated account balance. The combined portfolio is available under All accounts.'} Transactions through ${this.escape(data.coverage || 'not imported')}. Closing prices: Yahoo Finance${data.pricesUpdatedAt ? `, refreshed ${this.date(data.pricesUpdatedAt.slice(0, 10))}` : ''}.</p>
      ${data.reconciliation ? `<p>Opening balance check: reconstructed ${this.money(data.reconciliation.openingValue, 2)}; dashboard starting value ${this.money(data.reconciliation.reportedOpeningValue, 2)}. Difference: ${this.money(data.reconciliation.difference, 2)}. These are reconstructed records, not reconciled brokerage statements.</p>` : ''}
      <p>Weekly return uses <a href="https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/" target="_blank" rel="noopener">Modified Dietz</a> with day-end deposits and withdrawals. Cash, money-market funds, dividends and fees are included. Stock week % measures price change, adjusted for splits. A market holiday uses the last trading close; the first 2026 portfolio period starts December 31.</p>
      <p>Friday balances are captured after 6 p.m. New York time while the server is running. Missed weeks can be reconstructed once transaction exports cover them. Import each account’s full history since January 1, 2026; overlapping exports are deduplicated.</p>
      <button data-action="refresh">Refresh closing prices</button><form class="fl-import"><label>Account<select name="account" required><option value="">Choose account</option>${Object.entries(data.accounts).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select></label><label>Export through<input name="through" type="date" min="2026-01-01" required></label><label>Schwab transactions<input name="file" type="file" accept=".csv,text/csv" required></label><button type="submit">Import CSV</button></form><p class="fl-update-message" role="status"></p></details>`;
  },

  /** Render the headline performance, allocation, positions and full weekly activity ledger. */
  weekHtml(week) {
    const complete = this.data.weeks.filter(w => !w.upcoming), index = complete.findIndex(w => w.date === week.date);
    const issues = week.issues.length ? `<p class="fl-notice">${week.issues.map(i => this.escape(i)).join(' ')}</p>` : '';
    const cashWeight = week.total > 0 ? Math.max(0, week.cash / week.total * 100) : 0;
    const allocation = week.holdings.filter(h => h.weight > 0).slice(0, 8).map(h => ({ symbol: h.symbol, weight: h.weight }));
    const other = week.holdings.filter(h => h.weight > 0).slice(8).reduce((n, h) => n + h.weight, 0);
    if (other) allocation.push({ symbol: 'Other', weight: other });
    if (cashWeight) allocation.push({ symbol: 'Cash', weight: cashWeight });
    const colors = ['#b6cddd', '#829fae', '#638779', '#9ca782', '#b4a28d', '#877b98', '#666d78', '#a38181', '#535b61', '#444'];
    return `<div class="fl-week-title"><div><h2>Friday, ${this.date(week.date, true)}</h2><p>${this.date(week.periodStart)} close to ${this.date(week.date)} close · ${this.escape(this.data.accounts[this.account] || 'All 4 accounts')} · ${week.source === 'captured' ? 'Captured' : 'Reconstructed'}</p></div><div class="fl-arrows"><button data-step="-1" ${index <= 0 ? 'disabled' : ''} aria-label="Previous Friday">←</button><button data-step="1" ${index === complete.length - 1 ? 'disabled' : ''} aria-label="Next Friday">→</button></div></div>
      <div class="fl-stats"><div><small>PORTFOLIO AT CLOSE</small><strong>${this.money(week.total)}</strong><p>${week.holdings.length} positions · includes cash</p></div><div><small>PORTFOLIO THIS WEEK</small><strong class="${this.tone(week.weekPct)}">${this.percent(week.weekPct)}</strong><p>${week.profit === null ? 'Awaiting complete data' : `${this.money(week.profit)} · flow-adjusted`}</p></div><div><small>STOCK TRADES</small><strong>${week.tradeCount}</strong><p>${week.transactions.length} total activities</p></div></div>${issues}
      ${allocation.length ? `<div class="fl-section-title"><h3>What you owned</h3><span>Share of portfolio value</span></div><div class="fl-allocation" aria-label="Portfolio allocation">${allocation.map((a, i) => `<span style="width:${a.weight}%;background:${colors[i % colors.length]}" title="${a.symbol}: ${a.weight.toFixed(1)}%"></span>`).join('')}</div><div class="fl-allocation-labels">${allocation.map((a, i) => `<span><i style="background:${colors[i % colors.length]}"></i>${this.escape(a.symbol)} ${a.weight.toFixed(1)}%</span>`).join('')}</div>` : ''}
      <div class="fl-section-title"><h3>Positions at close</h3><span>Click a ticker for weekly detail</span></div><div class="fl-table-wrap"><table><thead><tr><th>Holding</th><th>Shares</th><th>Closing price</th><th>Stock week %</th><th>Market value</th><th>Weight</th><th>Activity</th></tr></thead><tbody>
      ${week.holdings.map(h => this.holdingHtml(h, week)).join('')}
      ${week.cash !== null ? `<tr><td>Cash & equivalents<small>Includes SWVXX</small></td><td></td><td></td><td></td><td>${this.money(week.cash)}</td><td>${week.total > 0 ? (week.cash / week.total * 100).toFixed(1) + '%' : 'Pending'}</td><td></td></tr>` : ''}
      </tbody></table></div>${!week.holdings.length ? '<p class="fl-empty">No verified positions available for this account and date.</p>' : ''}
      <div class="fl-section-title"><h3>This week’s transactions</h3><span>Trades, income & transfers</span></div>${this.transactionsHtml(week.transactions)}
      <p class="fl-footnote">${week.externalFlows ? `Net external flows: ${this.money(week.externalFlows)}. ` : ''}Closing prices use the final trading session on or before Friday.</p>`;
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
    return `<div class="fl-table-wrap"><table class="fl-transactions"><thead><tr><th>Date</th><th>Account</th><th>Activity</th><th>Symbol</th><th>Shares</th><th>Trade price</th><th>Amount</th></tr></thead><tbody>${[...transactions].reverse().map(t => `<tr><td>${this.date(t.date)}</td><td>${this.escape(this.data.accounts[t.account])}</td><td class="${t.action === 'Buy' ? 'fl-up' : t.action === 'Sell' ? 'fl-down' : ''}">${this.escape(t.action)}</td><td>${this.escape(t.symbol)}</td><td>${t.quantity === null ? '' : t.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td><td>${t.price === null ? '' : this.money(t.price, 2)}</td><td>${t.amount === null ? '' : this.money(t.amount, 2)}</td></tr>`).join('')}</tbody></table></div>`;
  },

  /** Navigate Fridays, expand positions and refresh prices using delegated controls. */
  async click(event) {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.week) {
      this.selected = button.dataset.week; this.expanded = null; this.draw();
      if (window.matchMedia('(max-width:760px)').matches) this.root.querySelector('.fl-week').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    else if (button.dataset.step) {
      const weeks = this.data.weeks.filter(w => !w.upcoming), i = weeks.findIndex(w => w.date === this.selected);
      this.selected = weeks[i + Number(button.dataset.step)]?.date || this.selected; this.expanded = null; this.draw();
    } else if (button.dataset.symbol) { this.expanded = this.expanded === button.dataset.symbol ? null : button.dataset.symbol; this.draw(); }
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
  },

  /** Import one account's full export with an explicit coverage date and visible error feedback. */
  async import(event) {
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
