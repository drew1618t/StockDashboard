/**
 * privateStudy.js - Family-only web view of the investment success workbook.
 */
const PrivateStudyDashboard = {
  async render(container) {
    container.innerHTML = '';
    const data = await API.getPrivateInvestment('study');
    const section = document.createElement('div');
    section.className = 'dashboard private-workbook-dashboard';

    PrivateNav.render(section, 'study');
    section.appendChild(this._header(data));
    WorkbookViewer.render(section, data.workbook, { title: 'Investment Success Study' });
    section.appendChild(this._download(data.limitations));
    container.appendChild(section);
  },

  _header(data) {
    const el = document.createElement('section');
    el.className = 'section private-workbook-header';
    el.innerHTML = `
      <div class="private-workbook-kicker">Research archive · As of ${this._escape(data.asOf)}</div>
      <h2 class="section-title">Investment Success Study</h2>
      <p>${this._escape(data.description)}</p>
    `;
    return el;
  },

  _metrics(counts) {
    const el = document.createElement('section');
    el.className = 'section';
    MetricCard.renderRow(el, [
      { label: 'Analyzed Episodes', value: Fmt.num(counts.analyzedEpisodes) },
      { label: 'Distinct Stocks', value: Fmt.num(counts.distinctTickers) },
      { label: 'Recorded Transactions', value: Fmt.num(counts.transactions) },
      { label: 'History Exclusions', value: Fmt.num(counts.excludedIncomplete + counts.episodeFailures) },
    ]);
    return el;
  },

  _patterns(patterns) {
    const el = document.createElement('section');
    el.className = 'section';
    el.innerHTML = `
      <h2 class="section-title">What the Winners Did Differently</h2>
      <div class="private-pattern-list">
        ${patterns.map(pattern => `
          <article class="private-pattern">
            <span>${this._escape(pattern.number)}</span>
            <div>
              <h3>${this._escape(pattern.title)}</h3>
              <p>${this._escape(pattern.evidence)}</p>
            </div>
          </article>
        `).join('')}
      </div>
    `;
    return el;
  },

  _episodeTable(episodes) {
    return this._tableSection(
      'Top Individual Holding Episodes',
      ['Rank', 'Account', 'Ticker', 'First Buy', 'Peak Date', 'Peak Return', 'Exit / Now', 'Peak Giveback'],
      episodes.map(episode => [
        Fmt.num(episode.rank),
        this._escape(episode.account),
        `<strong>${this._escape(episode.ticker)}</strong>`,
        this._escape(episode.firstBuyDate),
        this._escape(episode.peakDate),
        this._percent(episode.peakReturn),
        this._percent(episode.exitOrCurrentReturn),
        `<span class="tax-loss">${this._percent(episode.peakToEndDrawdown)}</span>`,
      ])
    );
  },

  _tickerTable(tickers) {
    return this._tableSection(
      'Top Stocks — Consistency Across Episodes',
      ['Rank', 'Ticker', 'Theme', 'Episodes', 'Median Peak', 'Best Peak', 'Days to Peak', 'Peak Giveback'],
      tickers.map(ticker => [
        Fmt.num(ticker.rank),
        `<strong>${this._escape(ticker.ticker)}</strong>`,
        this._escape(ticker.theme),
        Fmt.num(ticker.episodes),
        this._percent(ticker.medianPeakReturn),
        this._percent(ticker.bestPeakReturn),
        Fmt.num(ticker.medianDaysToPeak, 1),
        `<span class="tax-loss">${this._percent(ticker.medianPeakGiveback)}</span>`,
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

  _download(limitations) {
    const el = document.createElement('section');
    el.className = 'private-workbook-download';
    el.innerHTML = `
      <div>
        <h2>Original workbook</h2>
        <p>The download preserves the formulas, formatting, and complete workbook for use in Excel.</p>
      </div>
      <div class="private-download-actions">
        <a class="family-investing-action" href="/family/investments/files/study">Download complete workbook</a>
        <a class="family-investing-text-link" href="/writing/investment-winners-what-the-data-says">Read public lesson</a>
      </div>
    `;
    return el;
  },

  _percent(value) {
    return `${(Number(value || 0) * 100).toFixed(1)}%`;
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

window.PrivateStudyDashboard = PrivateStudyDashboard;
