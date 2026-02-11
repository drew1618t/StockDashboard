/**
 * liveSection.js — Live portfolio section rendered at the top of the Summary dashboard.
 * Fetches real-time position data from the Google Sheets poller and displays
 * portfolio metrics, a live positions table, and daily movers.
 */
const LiveSection = {
  _refreshTimer: null,

  /**
   * Render the live section into a container element.
   * @param {HTMLElement} container - Parent element to append into
   * @returns {HTMLElement|null} The rendered section, or null on failure
   */
  async render(container) {
    let liveData;
    try {
      liveData = await API.getLivePortfolio();
    } catch (err) {
      console.warn('[LiveSection] Could not load live data:', err.message);
      return null;
    }

    if (liveData.loading || !liveData.stocks || liveData.stocks.length === 0) {
      return null; // Skip rendering if data isn't ready yet
    }

    const section = document.createElement('div');
    section.className = 'live-section';
    section.id = 'live-section';

    // ── Section Header ──
    const header = document.createElement('div');
    header.className = 'section live-section-header';
    header.innerHTML = `
      <h2 class="section-title">
        Live Portfolio
        <span class="live-freshness" id="live-freshness">${this._freshness(liveData.lastFetchTime)}</span>
      </h2>
    `;
    section.appendChild(header);

    // ── Portfolio Metrics Row ──
    this._renderMetrics(section, liveData);

    // ── Live Positions Table ──
    this._renderTable(section, liveData);

    // ── Daily Movers ──
    this._renderMovers(section, liveData);

    container.appendChild(section);

    // Start auto-refresh
    this._startAutoRefresh();

    return section;
  },

  _renderMetrics(section, liveData) {
    const m = liveData.portfolioMetrics;
    const metricsRow = document.createElement('div');
    metricsRow.className = 'section';

    const cards = [
      {
        label: 'Portfolio Value',
        value: this._fmtDollars(m.totalValue),
        subtext: `${liveData.stocks.length} positions` + (liveData.cash ? ' + cash' : ''),
      },
      {
        label: "Today's Change",
        value: Fmt.pct(m.dayChangePct, true),
        colorClass: (m.dayChangePct || 0) >= 0 ? 'positive' : 'negative',
        subtext: this._fmtDollarChange(m.totalValue, m.dayChangePct),
      },
      {
        label: 'YTD Return',
        value: Fmt.pct(m.ytdChangePct, true),
        colorClass: (m.ytdChangePct || 0) >= 0 ? 'positive' : 'negative',
        subtext: m.ytdChangeDollars != null ? this._fmtDollars(m.ytdChangeDollars) : '',
      },
      {
        label: 'vs S&P 500',
        value: Fmt.pct(m.vsSP, true),
        colorClass: (m.vsSP || 0) >= 0 ? 'positive' : 'negative',
        subtext: `S&P YTD: ${Fmt.pct(m.spChangePct, true)}`,
      },
    ];

    MetricCard.renderRow(metricsRow, cards);
    section.appendChild(metricsRow);
  },

  _renderTable(section, liveData) {
    const tableSection = document.createElement('div');
    tableSection.className = 'section';
    tableSection.innerHTML = '<h2 class="section-title">Live Positions</h2>';

    // Build data array: stocks + cash row
    const tableData = liveData.stocks.map(s => ({ ...s }));
    if (liveData.cash) {
      tableData.push({
        ticker: 'CASH',
        shares: null,
        weightPct: liveData.cash.weightPct || 0,
        currentPrice: null,
        avgBuyPrice: null,
        dayChangePct: null,
        gainLossPct: null,
        positionValue: liveData.cash.value || 0,
      });
    }

    SortableTable.render(tableSection, {
      columns: [
        { key: 'ticker', label: 'Ticker', width: '70px' },
        { key: 'currentPrice', label: 'Price', format: v => v != null ? Fmt.price(v) : '—', align: 'right', width: '80px' },
        { key: 'dayChangePct', label: 'Today %', format: v => v != null ? Fmt.pct(v, true) : '—', align: 'right', width: '75px' },
        { key: 'weightPct', label: 'Weight', format: v => Fmt.pct(v), align: 'right', width: '70px' },
        { key: 'positionValue', label: 'Value', format: v => this._fmtDollars(v), align: 'right', width: '95px' },
        { key: 'gainLossPct', label: 'Gain/Loss', format: v => v != null ? Fmt.pct(v, true) : '—', align: 'right', width: '80px' },
        { key: 'avgBuyPrice', label: 'Avg Cost', format: v => v != null ? Fmt.price(v) : '—', align: 'right', width: '80px' },
        { key: 'shares', label: 'Shares', format: v => v != null ? Fmt.num(v, 0) : '—', align: 'right', width: '70px' },
      ],
      data: tableData,
      defaultSort: 'weightPct',
      onRowClick: (row) => {
        if (row.ticker !== 'CASH') {
          window.location.hash = `#deepdive?ticker=${row.ticker}`;
        }
      },
    });

    section.appendChild(tableSection);
  },

  _renderMovers(section, liveData) {
    // Only show movers if there are meaningful daily changes
    const withChanges = liveData.stocks.filter(s => s.dayChangePct !== 0);
    if (withChanges.length === 0) return;

    const moversSection = document.createElement('div');
    moversSection.className = 'section';
    moversSection.innerHTML = '<h2 class="section-title">Today\'s Movers</h2>';

    const grid = document.createElement('div');
    grid.className = 'top-performers-grid';

    const sorted = [...withChanges].sort((a, b) => b.dayChangePct - a.dayChangePct);
    const gainers = sorted.filter(s => s.dayChangePct > 0).slice(0, 5);
    const losers = sorted.filter(s => s.dayChangePct < 0).reverse().slice(0, 5);

    if (gainers.length > 0) {
      grid.appendChild(this._miniTable('Gainers', gainers));
    }
    if (losers.length > 0) {
      grid.appendChild(this._miniTable('Losers', losers));
    }

    moversSection.appendChild(grid);
    section.appendChild(moversSection);
  },

  _miniTable(title, data) {
    const card = document.createElement('div');
    card.className = 'mini-table-card';
    card.innerHTML = `<h3 class="mini-table-title">${title}</h3>`;

    const table = document.createElement('div');
    table.className = 'mini-table';
    data.forEach(row => {
      table.innerHTML += `
        <div class="mini-row">
          <span>${row.ticker}</span>
          <span class="text-right">${Fmt.pct(row.dayChangePct, true)}</span>
          <span class="text-right">${Fmt.price(row.currentPrice)}</span>
        </div>
      `;
    });
    card.appendChild(table);
    return card;
  },

  // ── Auto-refresh ──

  _startAutoRefresh() {
    this.stopAutoRefresh();
    this._refreshTimer = setInterval(async () => {
      console.log('[LiveSection] Auto-refreshing...');
      try {
        API._cache.live_portfolio = null; // clear cache to force re-fetch
        const liveData = await API.getLivePortfolio(true);
        // Update freshness indicator
        const el = document.getElementById('live-freshness');
        if (el) el.textContent = this._freshness(liveData.lastFetchTime);
      } catch (err) {
        console.warn('[LiveSection] Auto-refresh failed:', err.message);
      }
    }, 5 * 60 * 1000); // 5 minutes
  },

  stopAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  },

  // ── Formatters ──

  _fmtDollars(v) {
    if (v == null) return 'N/A';
    const n = Number(v);
    const neg = n < 0;
    const abs = Math.abs(n);
    let formatted;
    if (abs >= 1e6) {
      formatted = '$' + (abs / 1e6).toFixed(2) + 'M';
    } else if (abs >= 1e3) {
      formatted = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } else {
      formatted = '$' + abs.toFixed(2);
    }
    return neg ? '-' + formatted : formatted;
  },

  _fmtDollarChange(totalValue, pct) {
    if (totalValue == null || pct == null) return '';
    const change = (totalValue * pct) / 100;
    return this._fmtDollars(change);
  },

  _freshness(timestamp) {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `Updated ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Updated ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `Updated ${hours}h ago`;
  },
};

window.LiveSection = LiveSection;
