/**
 * summary.js — Dashboard 5: Portfolio Summary
 * Overview metrics, top performers, Saul compliance, alerts.
 */
const SummaryDashboard = {
  async render(container, companies) {
    container.innerHTML = '';

    const section = document.createElement('div');
    section.className = 'dashboard summary-dashboard';

    // ── Live Portfolio Section (from Google Sheets) ──
    try {
      await LiveSection.render(section);
    } catch (err) {
      console.warn('[Summary] Live section skipped:', err.message);
    }

    // ── Fundamentals Metrics Bar ──
    const profitable = companies.filter(c => c.currentlyProfitable === true);
    const withGrowth = companies.filter(c => c.revenueYoyPct !== null);
    const avgGrowth = withGrowth.length > 0
      ? withGrowth.reduce((s, c) => s + c.revenueYoyPct, 0) / withGrowth.length
      : null;
    const totalMarketCap = companies.reduce((s, c) => s + (c.marketCapMil || 0), 0);
    const verdicts = { PASS: 0, CAUTION: 0, DISQUALIFIED: 0, FAIL: 0, OTHER: 0 };
    companies.forEach(c => {
      const v = (c.verdict || '').toUpperCase();
      if (v in verdicts) verdicts[v]++;
      else verdicts.OTHER++;
    });

    const metricsRow = document.createElement('div');
    metricsRow.className = 'section';
    MetricCard.renderRow(metricsRow, [
      { label: 'Avg Revenue Growth', value: Fmt.pct(avgGrowth), subtext: 'YoY unweighted', colorClass: avgGrowth > 35 ? 'positive' : 'neutral' },
      { label: 'Total Market Cap', value: Fmt.millions(totalMarketCap) },
      { label: 'Profitable', value: `${profitable.length}/${companies.length}`, subtext: 'EBITDA positive' },
      { label: 'Verdicts', value: `${verdicts.PASS}P / ${verdicts.CAUTION}C / ${verdicts.DISQUALIFIED + verdicts.FAIL}F` },
    ]);
    section.appendChild(metricsRow);

    // ── Top Performers Table ──
    const topSection = document.createElement('div');
    topSection.className = 'section';
    topSection.innerHTML = '<h2 class="section-title">Top Performers</h2>';

    const topGrid = document.createElement('div');
    topGrid.className = 'top-performers-grid';

    // Highest Growth
    const byGrowth = [...withGrowth].sort((a, b) => (b.revenueYoyPct || 0) - (a.revenueYoyPct || 0));
    topGrid.appendChild(this._miniTable('Fastest Growing', byGrowth.slice(0, 5), [
      { key: 'ticker', label: 'Ticker', width: '60px' },
      { key: 'revenueYoyPct', label: 'YoY %', format: v => Fmt.pct(v, true), align: 'right', width: '80px' },
    ]));

    // Best Operating Leverage
    const withLeverage = companies.filter(c => c.calculated?.operatingLeverage !== null);
    const byLeverage = [...withLeverage].sort((a, b) =>
      (b.calculated?.operatingLeverage || 0) - (a.calculated?.operatingLeverage || 0)
    );
    topGrid.appendChild(this._miniTable('Best Op. Leverage', byLeverage.slice(0, 5), [
      { key: 'ticker', label: 'Ticker', width: '60px' },
      { key: '_leverage', label: 'Ratio', format: (_, r) => Fmt.multiple(r.calculated?.operatingLeverage), align: 'right', width: '80px' },
    ]));

    // Cheapest by P/E (run-rate preferred)
    const _ePe = c => c.runRatePe || c.trailingPe || c.normalizedPe || null;
    const withPE = companies.filter(c => _ePe(c) !== null);
    const byPE = [...withPE].sort((a, b) => (_ePe(a) || 999) - (_ePe(b) || 999));
    topGrid.appendChild(this._miniTable('Cheapest (P/E)', byPE.slice(0, 5), [
      { key: 'ticker', label: 'Ticker', width: '60px' },
      { key: '_pe', label: 'P/E', format: (_, r) => { const pe = _ePe(r); return pe ? pe.toFixed(1) + 'x' : 'N/A'; }, align: 'right', width: '80px' },
    ]));

    // Best GAV
    const withGav = companies.filter(c => c.calculated?.gav !== null);
    const byGav = [...withGav].sort((a, b) =>
      (a.calculated?.gav || 999) - (b.calculated?.gav || 999)
    );
    topGrid.appendChild(this._miniTable('Best Growth-Adj Val', byGav.slice(0, 5), [
      { key: 'ticker', label: 'Ticker', width: '60px' },
      { key: '_gav', label: 'GAV', format: (_, r) => r.calculated?.gav?.toFixed(1) || 'N/A', align: 'right', width: '80px' },
    ]));

    topSection.appendChild(topGrid);
    section.appendChild(topSection);

    // ── Alerts Panel ──
    const alertSection = document.createElement('div');
    alertSection.className = 'section';
    alertSection.innerHTML = '<h2 class="section-title">Alerts & Watch Items</h2>';
    const alertsDiv = document.createElement('div');
    alertsDiv.className = 'alerts-panel';

    const alerts = [];

    // Decelerating stocks
    companies.forEach(c => {
      if (c.calculated?.momentum?.trend === 'decelerating') {
        alerts.push({ type: 'warning', ticker: c.ticker, message: `QoQ momentum decelerating (${Fmt.pct(c.calculated.momentum.delta, true)})` });
      }
    });

    // Insider selling
    companies.forEach(c => {
      if (c.recentInsiderSelling) {
        alerts.push({ type: 'info', ticker: c.ticker, message: 'Recent insider selling activity' });
      }
    });

    // Failed Saul evaluation
    companies.forEach(c => {
      if (c.verdict === 'DISQUALIFIED' || c.verdict === 'FAIL') {
        alerts.push({ type: 'danger', ticker: c.ticker, message: `Verdict: ${c.verdict}` });
      }
    });

    // Red flags from markdown
    companies.forEach(c => {
      (c.redFlags || []).slice(0, 1).forEach(flag => {
        alerts.push({ type: 'warning', ticker: c.ticker, message: flag.substring(0, 120) });
      });
    });

    if (alerts.length === 0) {
      alertsDiv.innerHTML = '<div class="alert alert-info">No alerts at this time</div>';
    } else {
      alerts.forEach(alert => {
        alertsDiv.innerHTML += `
          <div class="alert alert-${alert.type}">
            <span class="alert-ticker">${alert.ticker}</span>
            <span class="alert-message">${alert.message}</span>
          </div>
        `;
      });
    }

    alertSection.appendChild(alertsDiv);
    section.appendChild(alertSection);

    container.appendChild(section);
  },

  _miniTable(title, data, columns) {
    const card = document.createElement('div');
    card.className = 'mini-table-card';
    card.innerHTML = `<h3 class="mini-table-title">${title}</h3>`;

    const table = document.createElement('div');
    table.className = 'mini-table';
    data.forEach(row => {
      let rowHtml = '';
      columns.forEach(col => {
        let val = row[col.key];
        if (col.format) val = col.format(val, row);
        else if (val === null || val === undefined) val = 'N/A';
        rowHtml += `<span class="${col.align === 'right' ? 'text-right' : ''}">${val}</span>`;
      });
      table.innerHTML += `<div class="mini-row">${rowHtml}</div>`;
    });
    card.appendChild(table);
    return card;
  },

  destroy() {
    LiveSection.stopAutoRefresh();
  },
};

window.SummaryDashboard = SummaryDashboard;
