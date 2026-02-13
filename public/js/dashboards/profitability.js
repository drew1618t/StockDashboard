/**
 * profitability.js — Dashboard 3: Profitability & Operating Leverage
 * Margin charts, leverage bars, revenue vs EBITDA growth comparison.
 */
const ProfitabilityDashboard = {
  async render(container, companies) {
    container.innerHTML = '';
    this.destroy();

    const section = document.createElement('div');
    section.className = 'dashboard profitability-dashboard';

    // ── Margin Comparison: Grouped Bars ──
    const marginSection = document.createElement('div');
    marginSection.className = 'section';
    marginSection.innerHTML = `
      <h2 class="section-title">Margin Comparison</h2>
      <div class="chart-container chart-tall"><canvas id="prof-margin-chart"></canvas></div>
    `;
    section.appendChild(marginSection);

    const withMargins = companies.filter(c =>
      c.grossMarginPct !== null || c.ebitdaMarginPct !== null
    ).sort((a, b) => (b.grossMarginPct || 0) - (a.grossMarginPct || 0));

    setTimeout(() => {
      BarChart.render('prof-margin-chart', {
        labels: withMargins.map(c => c.ticker),
        datasets: [
          {
            label: 'Gross Margin %',
            data: withMargins.map(c => c.grossMarginPct),
            color: Colors.chartPalette[0],
          },
          {
            label: 'EBITDA Margin %',
            data: withMargins.map(c => c.ebitdaMarginPct),
            color: Colors.chartPalette[1],
          },
        ],
        yLabel: 'Margin %',
      });
    }, 50);

    // ── Operating Leverage ──
    const leverageSection = document.createElement('div');
    leverageSection.className = 'section';
    leverageSection.innerHTML = `
      <h2 class="section-title">Operating Leverage (\u0394EBITDA \u00F7 \u0394Revenue)</h2>
      <p class="section-subtitle">>0.5x = strong margin expansion. Measures incremental EBITDA per $1 of revenue growth.</p>
      <div class="chart-container"><canvas id="prof-leverage-chart"></canvas></div>
    `;
    section.appendChild(leverageSection);

    const withLeverage = companies
      .filter(c => c.calculated?.operatingLeverage !== null && c.calculated?.operatingLeverage !== undefined)
      .sort((a, b) => b.calculated.operatingLeverage - a.calculated.operatingLeverage);

    setTimeout(() => {
      BarChart.render('prof-leverage-chart', {
        labels: withLeverage.map(c => c.ticker),
        datasets: [{
          label: 'Op. Leverage Ratio',
          data: withLeverage.map(c => c.calculated.operatingLeverage),
          colors: withLeverage.map(c =>
            c.calculated.operatingLeverage > 0.5 ? 'var(--color-positive)' :
            c.calculated.operatingLeverage > 0.2 ? 'var(--color-warning)' :
            'var(--color-negative)'
          ),
        }],
        horizontal: true,
        yLabel: 'Leverage Ratio',
      });
    }, 50);

    // ── Revenue vs EBITDA Growth ──
    const compSection = document.createElement('div');
    compSection.className = 'section';
    compSection.innerHTML = `
      <h2 class="section-title">Revenue Growth vs EBITDA Growth</h2>
      <div class="chart-container chart-tall"><canvas id="prof-rev-ebitda-chart"></canvas></div>
    `;
    section.appendChild(compSection);

    const withBoth = companies.filter(c =>
      c.revenueYoyPct !== null && c.ebitdaYoyPct !== null
    ).sort((a, b) => (b.revenueYoyPct || 0) - (a.revenueYoyPct || 0));

    setTimeout(() => {
      const revEbitdaDatasets = [
        {
          label: 'Revenue YoY %',
          data: withBoth.map(c => c.revenueYoyPct),
          color: Colors.chartPalette[0],
        },
        {
          label: 'EBITDA YoY %',
          data: withBoth.map(c => c.ebitdaYoyPct),
          color: Colors.chartPalette[1],
        },
      ];

      // Detect and handle outliers
      const outlierResult = OutlierScale.buildYScale(revEbitdaDatasets);
      const originalData = revEbitdaDatasets.map(ds => [...ds.data]);

      // Cap data values so bars stop at the axis limit
      if (outlierResult) {
        revEbitdaDatasets.forEach(ds => {
          ds.data = ds.data.map(v => {
            if (v === null) return null;
            if (outlierResult.outlierInfo.cap !== null && v > outlierResult.outlierInfo.cap) return outlierResult.outlierInfo.cap;
            if (outlierResult.outlierInfo.floor !== null && v < outlierResult.outlierInfo.floor) return outlierResult.outlierInfo.floor;
            return v;
          });
        });
      }

      BarChart.render('prof-rev-ebitda-chart', {
        labels: withBoth.map(c => c.ticker),
        datasets: revEbitdaDatasets,
        yLabel: 'Growth %',
        yScale: outlierResult?.yScale,
        plugins: outlierResult
          ? [OutlierScale.annotationPlugin(outlierResult.outlierInfo, originalData)]
          : [],
        tooltipFormat: outlierResult ? (context) => {
          const orig = originalData[context.datasetIndex]?.[context.dataIndex];
          const display = orig !== null && orig !== undefined ? orig.toFixed(1) + '%' : 'N/A';
          return `${context.dataset.label}: ${display}`;
        } : undefined,
      });
    }, 50);

    // ── Profitability Table ──
    const tableSection = document.createElement('div');
    tableSection.className = 'section';
    tableSection.innerHTML = '<h2 class="section-title">Profitability Metrics</h2>';

    SortableTable.render(tableSection, {
      columns: [
        { key: 'ticker', label: 'Ticker', width: '70px' },
        { key: 'grossMarginPct', label: 'GM%', format: v => Fmt.pct(v), align: 'right', width: '60px' },
        { key: 'ebitdaMarginPct', label: 'EBITDA%', format: v => Fmt.pct(v), align: 'right', width: '75px' },
        { key: 'ebitdaYoyPct', label: 'EBITDA YoY%', format: v => Fmt.pct(v, true), align: 'right', width: '90px' },
        { key: 'revenueYoyPct', label: 'Rev YoY%', format: v => Fmt.pct(v, true), align: 'right', width: '80px' },
        { key: '_leverage', label: 'Op Leverage', format: (_, r) => Fmt.multiple(r.calculated?.operatingLeverage), align: 'right', width: '90px' },
        { key: 'freeCashFlowMil', label: 'FCF', format: v => Fmt.millions(v), align: 'right', width: '80px' },
        { key: 'currentlyProfitable', label: 'Profitable', format: v => v === true ? '\u2713' : v === false ? '\u2717' : '?', width: '70px' },
      ],
      data: companies.map(c => ({
        ...c,
        _leverage: c.calculated?.operatingLeverage ?? null,
      })),
      defaultSort: '_leverage',
      onRowClick: (row) => {
        window.location.hash = `#deepdive?ticker=${row.ticker}`;
      },
    });
    section.appendChild(tableSection);

    container.appendChild(section);
  },

  destroy() {
    BarChart.destroyAll();
  },
};

window.ProfitabilityDashboard = ProfitabilityDashboard;
