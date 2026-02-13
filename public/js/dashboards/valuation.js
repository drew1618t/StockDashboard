/**
 * valuation.js — Dashboard 2: Valuation & Quality
 * Scatter plot (growth vs P/E), GAV bars (PEG-like), P/E comparison, quality table.
 */
const ValuationDashboard = {
  /** Get effective P/E: run-rate preferred, then trailing, then normalized */
  _effectivePe(c) {
    return c.runRatePe || c.trailingPe || c.normalizedPe || null;
  },

  /** Label for which P/E variant is being used */
  _peLabel(c) {
    if (c.runRatePe) return 'Run Rate';
    if (c.trailingPe) return 'Trailing';
    if (c.normalizedPe) return 'Normalized';
    return 'N/A';
  },

  async render(container, companies) {
    container.innerHTML = '';
    this.destroy();

    const section = document.createElement('div');
    section.className = 'dashboard valuation-dashboard';

    const self = this;

    // ── Scatter Plot: Growth vs P/E ──
    const scatterSection = document.createElement('div');
    scatterSection.className = 'section';
    scatterSection.innerHTML = `
      <h2 class="section-title">Growth vs P/E Valuation</h2>
      <div class="chart-container chart-tall"><canvas id="val-scatter-chart"></canvas></div>
    `;
    section.appendChild(scatterSection);

    // Build scatter points
    const points = companies
      .filter(c => c.revenueYoyPct !== null && self._effectivePe(c) !== null)
      .map(c => ({
        x: c.revenueYoyPct,
        y: self._effectivePe(c),
        label: c.ticker,
        color: Colors.verdictColor(c.verdict),
        size: Math.max(4, Math.min(12, (c.marketCapMil || 1000) / 1000)),
      }));

    // Check for outliers on both axes
    const scatterScales = OutlierScale.buildScatterScales(points);

    // Render after DOM is ready
    setTimeout(() => {
      ScatterPlot.render('val-scatter-chart', {
        points,
        xLabel: 'Revenue YoY Growth %',
        yLabel: 'Run-Rate P/E',
        xScale: scatterScales?.xScale || undefined,
        yScale: scatterScales?.yScale || undefined,
      });
    }, 50);

    // ── Growth-Adjusted Valuation Bar Chart ──
    const gavSection = document.createElement('div');
    gavSection.className = 'section';
    gavSection.innerHTML = `
      <h2 class="section-title">Growth-Adjusted Valuation (P/E \u00F7 Growth)</h2>
      <p class="section-subtitle">Lower = cheaper relative to growth (PEG-like ratio)</p>
      <div class="chart-container"><canvas id="val-gav-chart"></canvas></div>
    `;
    section.appendChild(gavSection);

    const withGav = companies
      .filter(c => c.calculated?.gav !== null && c.calculated?.gav !== undefined)
      .sort((a, b) => a.calculated.gav - b.calculated.gav);

    setTimeout(() => {
      BarChart.render('val-gav-chart', {
        labels: withGav.map(c => c.ticker),
        datasets: [{
          label: 'GAV (P/E \u00F7 Growth%)',
          data: withGav.map(c => c.calculated.gav),
          colors: withGav.map((c) => {
            const median = withGav[Math.floor(withGav.length / 2)]?.calculated?.gav || 1;
            return c.calculated.gav <= median ? 'var(--color-positive)' : 'var(--color-warning)';
          }),
        }],
        yLabel: 'GAV (lower = better)',
      });
    }, 50);

    // ── P/E Ratio Comparison ──
    const peSection = document.createElement('div');
    peSection.className = 'section';
    peSection.innerHTML = `
      <h2 class="section-title">P/E Ratios (Run-Rate preferred)</h2>
      <div class="chart-container"><canvas id="val-pe-chart"></canvas></div>
    `;
    section.appendChild(peSection);

    const withPE = companies
      .filter(c => self._effectivePe(c) !== null)
      .sort((a, b) => self._effectivePe(a) - self._effectivePe(b));

    setTimeout(() => {
      BarChart.render('val-pe-chart', {
        labels: withPE.map(c => c.ticker),
        datasets: [{
          label: 'P/E Ratio',
          data: withPE.map(c => self._effectivePe(c)),
          colors: withPE.map(c => {
            const pe = self._effectivePe(c);
            return pe < 30 ? 'var(--color-positive)' :
                   pe < 80 ? 'var(--color-warning)' :
                   'var(--color-negative)';
          }),
        }],
        yLabel: 'P/E Ratio',
      });
    }, 50);

    // ── Quality Table ──
    const tableSection = document.createElement('div');
    tableSection.className = 'section';
    tableSection.innerHTML = '<h2 class="section-title">Valuation & Quality Metrics</h2>';

    SortableTable.render(tableSection, {
      columns: [
        { key: 'ticker', label: 'Ticker', width: '70px' },
        { key: 'revenueYoyPct', label: 'Rev YoY%', format: v => Fmt.pct(v, true), align: 'right', width: '80px' },
        { key: '_pe', label: 'P/E', format: (_, r) => { const pe = self._effectivePe(r); return pe ? pe.toFixed(1) + 'x' : 'N/A'; }, align: 'right', width: '70px' },
        { key: '_peType', label: 'P/E Type', format: (_, r) => self._peLabel(r), width: '80px' },
        { key: '_gav', label: 'GAV', format: (_, r) => r.calculated?.gav?.toFixed(2) || 'N/A', align: 'right', width: '60px' },
        { key: 'grossMarginPct', label: 'GM%', format: v => Fmt.pct(v), align: 'right', width: '60px' },
        { key: 'ebitdaMarginPct', label: 'EBITDA%', format: v => Fmt.pct(v), align: 'right', width: '70px' },
        { key: 'verdict', label: 'Verdict', format: v => Fmt.verdict(v), width: '100px' },
      ],
      data: companies.map(c => ({
        ...c,
        _pe: self._effectivePe(c) ?? null,
        _peType: self._peLabel(c),
        _gav: c.calculated?.gav ?? null,
      })),
      defaultSort: '_gav',
      defaultDir: 'asc',
      onRowClick: (row) => {
        window.location.hash = `#deepdive?ticker=${row.ticker}`;
      },
    });
    section.appendChild(tableSection);

    container.appendChild(section);
  },

  destroy() {
    ScatterPlot.destroyAll();
    BarChart.destroyAll();
  },
};

window.ValuationDashboard = ValuationDashboard;
