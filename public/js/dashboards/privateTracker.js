/**
 * privateTracker.js - Family-only web view of the portfolio tracker workbook.
 */
const PrivateTrackerDashboard = {
  async render(container) {
    container.innerHTML = '';
    const data = await API.getPrivateInvestment('tracker');
    const section = document.createElement('div');
    section.className = 'dashboard private-workbook-dashboard';

    PrivateNav.render(section, 'tracker');
    section.appendChild(this._header(data));
    WorkbookViewer.render(section, data.workbook, { title: 'Account Tracker' });
    section.appendChild(this._download(data.note));
    container.appendChild(section);
  },

  _header(data) {
    const el = document.createElement('section');
    el.className = 'section private-workbook-header';
    el.innerHTML = `
      <div class="private-workbook-kicker">Living record · As of ${this._escape(data.asOf)}</div>
      <h2 class="section-title">Account Tracker</h2>
      <p>${this._escape(data.description)}</p>
    `;
    return el;
  },

  _metrics(summary) {
    const el = document.createElement('section');
    el.className = 'section';
    MetricCard.renderRow(el, [
      { label: 'Total Portfolio', value: this._money(summary.totalPortfolio) },
      { label: 'Equity Value', value: this._money(summary.equityValue) },
      { label: 'Cash & Equivalents', value: this._money(summary.cashEquivalents) },
      { label: 'Transactions', value: Fmt.num(summary.transactions) },
      { label: 'Active Holdings', value: Fmt.num(summary.activeHoldings), subtext: summary.modelStatus },
    ]);
    return el;
  },

  _accountTable(accounts) {
    return this._tableSection(
      'Account Summary',
      ['Account', 'Equity', 'Cash', 'Positions', 'Transactions', 'Data Issues'],
      accounts.map(account => [
        this._escape(account.account),
        this._money(account.equityValue),
        this._money(account.totalCash),
        Fmt.num(account.activePositions),
        Fmt.num(account.transactions),
        Fmt.num(account.dataIssues),
      ])
    );
  },

  _holdingsTable(holdings) {
    return this._tableSection(
      'Current Consolidated Holdings',
      ['Ticker', 'Shares', 'Price', 'Current Value', 'Weight', 'Est. Lifetime P/L', 'Return / Cost'],
      holdings.map(holding => [
        `<strong>${this._escape(holding.ticker)}</strong>`,
        Fmt.num(holding.totalShares),
        Fmt.price(holding.price),
        this._money(holding.currentValue),
        this._percent(holding.weight),
        `<span class="${this._gainClass(holding.estimatedLifetimeProfitLoss)}">${this._money(holding.estimatedLifetimeProfitLoss)}</span>`,
        `<span class="${this._gainClass(holding.returnOnCost)}">${this._percent(holding.returnOnCost)}</span>`,
      ])
    );
  },

  _tableSection(title, headers, rows) {
    const el = document.createElement('section');
    el.className = 'section';
    el.innerHTML = `
      <h2 class="section-title">${this._escape(title)}</h2>
      <div class="private-table-scroll">
        <table class="private-data-table">
          <thead><tr>${headers.map(header => `<th>${this._escape(header)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `;
    return el;
  },

  _download(note) {
    const el = document.createElement('section');
    el.className = 'private-workbook-download';
    el.innerHTML = `
      <p>${this._escape(note)}</p>
      <a class="family-investing-action" href="/family/investments/files/tracker">Download complete workbook</a>
    `;
    return el;
  },

  _money(value) {
    const amount = Number(value || 0);
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  },

  _percent(value) {
    return `${(Number(value || 0) * 100).toFixed(1)}%`;
  },

  _gainClass(value) {
    return Number(value || 0) > 0 ? 'tax-gain' : Number(value || 0) < 0 ? 'tax-loss' : '';
  },

  _escape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  destroy() {},
};

window.PrivateTrackerDashboard = PrivateTrackerDashboard;
