/**
 * growth.js — Dashboard 1: Growth Overview
 * Heatmap, sparklines, sortable table, filters.
 */
const GrowthDashboard = {
  _charts: [],

  async render(container, companies) {
    container.innerHTML = '';
    this.destroy();

    const section = document.createElement('div');
    section.className = 'dashboard growth-dashboard';

    // ── Filters ──
    const filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';
    filterBar.innerHTML = `
      <label class="filter-item">
        <span>Min Growth:</span>
        <select id="growth-filter-min">
          <option value="0">All</option>
          <option value="25">≥25%</option>
          <option value="35">≥35%</option>
          <option value="50">≥50%</option>
        </select>
      </label>
      <label class="filter-item">
        <input type="checkbox" id="growth-filter-accel"> Accelerating only
      </label>
      <label class="filter-item">
        <input type="checkbox" id="growth-filter-profit"> Profitable only
      </label>
    `;
    section.appendChild(filterBar);

    // Data container for re-renders
    const dataContainer = document.createElement('div');
    dataContainer.id = 'growth-data-container';
    section.appendChild(dataContainer);

    container.appendChild(section);

    // Apply filters and render
    const self = this;
    function applyFilters() {
      const minGrowth = parseInt(document.getElementById('growth-filter-min')?.value || '0');
      const accelOnly = document.getElementById('growth-filter-accel')?.checked || false;
      const profitOnly = document.getElementById('growth-filter-profit')?.checked || false;

      let filtered = companies.filter(c => {
        if (c.revenueYoyPct !== null && c.revenueYoyPct < minGrowth) return false;
        if (accelOnly && c.calculated?.momentum?.trend !== 'accelerating') return false;
        if (profitOnly && c.currentlyProfitable !== true) return false;
        return true;
      });

      self._renderData(dataContainer, filtered, companies);
    }

    // Bind filter events
    document.getElementById('growth-filter-min')?.addEventListener('change', applyFilters);
    document.getElementById('growth-filter-accel')?.addEventListener('change', applyFilters);
    document.getElementById('growth-filter-profit')?.addEventListener('change', applyFilters);

    applyFilters();
  },

  _renderData(container, filtered, allCompanies) {
    container.innerHTML = '';
    this.destroy();

    // ── Revenue Growth Heatmap ──
    const heatSection = document.createElement('div');
    heatSection.className = 'section';
    heatSection.innerHTML = '<h2 class="section-title">Revenue Growth Heatmap (YoY %)</h2>';
    Heatmap.render(heatSection, filtered);
    container.appendChild(heatSection);

    // ── Revenue Growth Trend Lines ──
    const chartSection = document.createElement('div');
    chartSection.className = 'section';
    chartSection.innerHTML = `
      <h2 class="section-title">YoY Revenue Growth Trends</h2>
      <div class="chart-container"><canvas id="growth-trend-chart"></canvas></div>
    `;
    container.appendChild(chartSection);

    // Build datasets for line chart
    const quarterSet = new Set();
    filtered.forEach(c => (c.quarterlyHistory || []).forEach(q => quarterSet.add(q.quarter)));
    const quarters = [...quarterSet].sort((a, b) => {
      const [qa, ya] = a.replace('Q', '').split(' ');
      const [qb, yb] = b.replace('Q', '').split(' ');
      return (ya + qa).localeCompare(yb + qb);
    });

    const datasets = filtered
      .filter(c => (c.quarterlyHistory || []).length >= 2)
      .map((company, i) => {
        const histMap = {};
        (company.quarterlyHistory || []).forEach(q => { histMap[q.quarter] = q.revenueYoyPct; });
        return {
          label: company.ticker,
          data: quarters.map(q => histMap[q] ?? null),
          color: Colors.chartColor(i),
        };
      });

    if (quarters.length > 0 && datasets.length > 0) {
      LineChart.render('growth-trend-chart', {
        labels: quarters,
        datasets,
        yLabel: 'YoY Growth %',
      });
    }

    // ── Sortable Growth Table ──
    const tableSection = document.createElement('div');
    tableSection.className = 'section';
    tableSection.innerHTML = '<h2 class="section-title">Growth Rankings</h2>';

    SortableTable.render(tableSection, {
      columns: [
        { key: 'ticker', label: 'Ticker', width: '70px' },
        { key: 'revenueRecentMil', label: 'Revenue', format: v => Fmt.millions(v), align: 'right', width: '90px' },
        { key: 'revenueYoyPct', label: 'YoY %', format: v => Fmt.pct(v, true), align: 'right', width: '75px' },
        { key: 'revenueQoqPct', label: 'QoQ %', format: v => Fmt.pct(v, true), align: 'right', width: '75px' },
        { key: '_momentum', label: 'Momentum', format: (_, r) => Fmt.momentum(r.calculated?.momentum?.trend), width: '120px' },
        { key: '_momentumDelta', label: '\u0394QoQ', format: (_, r) => Fmt.delta(r.calculated?.momentum?.delta), align: 'right', width: '70px', sortable: true },
        { key: 'marketCapMil', label: 'Mkt Cap', format: v => Fmt.millions(v), align: 'right', width: '80px' },
      ],
      data: filtered.map(c => ({
        ...c,
        _momentumDelta: c.calculated?.momentum?.delta ?? null,
      })),
      defaultSort: 'revenueYoyPct',
      onRowClick: (row) => {
        window.location.hash = `#deepdive?ticker=${row.ticker}`;
      },
    });

    container.appendChild(tableSection);
  },

  destroy() {
    LineChart.destroyAll();
  },
};

window.GrowthDashboard = GrowthDashboard;
