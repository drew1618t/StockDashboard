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

    const colorMap = Colors.buildColorMap(companies);

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
      // Gross margin as decimal (e.g. 70% → 0.70) = theoretical ceiling for op leverage
      const gmValues = withLeverage.map(c =>
        c.grossMarginPct != null ? c.grossMarginPct / 100 : null
      );

      const gmMarkerPlugin = {
        id: 'grossMarginMarkers',
        afterDraw(chart) {
          const ctx = chart.ctx;
          const xScale = chart.scales.x;
          const yScale = chart.scales.y;
          const styles = getComputedStyle(document.body);
          const markerColor = styles.getPropertyValue('--text-muted').trim() || '#888';

          ctx.save();
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);

          gmValues.forEach((gm, i) => {
            if (gm === null) return;
            const xPixel = xScale.getPixelForValue(gm);
            const yPixel = yScale.getPixelForValue(i);
            const barHeight = yScale.getPixelForValue(0) - yScale.getPixelForValue(1);
            const halfBar = Math.abs(barHeight) * 0.35;

            // Dashed vertical tick at the GM value
            ctx.beginPath();
            ctx.moveTo(xPixel, yPixel - halfBar);
            ctx.lineTo(xPixel, yPixel + halfBar);
            ctx.stroke();
          });

          // Draw legend entry for the GM marker
          const lastGmIdx = gmValues.findLastIndex(v => v !== null);
          if (lastGmIdx >= 0) {
            ctx.fillStyle = markerColor;
            ctx.font = `10px ${styles.getPropertyValue('--font-body').trim() || 'sans-serif'}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const xPixel = xScale.getPixelForValue(gmValues[lastGmIdx]);
            const yPixel = yScale.getPixelForValue(lastGmIdx);
            const barHeight = yScale.getPixelForValue(0) - yScale.getPixelForValue(1);
            const halfBar = Math.abs(barHeight) * 0.35;
            ctx.fillText('GM', xPixel + 4, yPixel + halfBar + 2);
          }

          ctx.restore();
        },
      };

      BarChart.render('prof-leverage-chart', {
        labels: withLeverage.map(c => c.ticker),
        datasets: [{
          label: 'Op. Leverage Ratio',
          data: withLeverage.map(c => c.calculated.operatingLeverage),
          colors: withLeverage.map(c => {
            if (c._isComparison) return colorMap[c.ticker];
            return c.calculated.operatingLeverage > 0.5 ? 'var(--color-positive)' :
                   c.calculated.operatingLeverage > 0.2 ? 'var(--color-warning)' :
                   'var(--color-negative)';
          }),
        }],
        horizontal: true,
        yLabel: 'Leverage Ratio',
        plugins: [gmMarkerPlugin],
        tooltipFormat: (context) => {
          const gm = gmValues[context.dataIndex];
          const val = context.raw?.toFixed(2) || 'N/A';
          const gmStr = gm != null ? (gm * 100).toFixed(0) + '%' : 'N/A';
          return `Op. Leverage: ${val}x  |  Gross Margin: ${gmStr}`;
        },
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
