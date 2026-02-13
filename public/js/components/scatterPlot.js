/**
 * scatterPlot.js — Scatter plot for growth vs valuation analysis.
 */
const ScatterPlot = {
  _instances: {},

  /**
   * @param {string} canvasId
   * @param {Object} opts
   * @param {Array<{x, y, label, color?, size?}>} opts.points
   * @param {string} opts.xLabel
   * @param {string} opts.yLabel
   */
  render(canvasId, opts) {
    this.destroy(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');

    // Group by color for separate datasets (so legend works)
    const points = opts.points || [];

    const config = {
      type: 'scatter',
      data: {
        datasets: [{
          data: points.map(p => ({ x: p.x, y: p.y })),
          backgroundColor: points.map(p => p.color || Colors.chartColor(0)),
          borderColor: points.map(p => p.color || Colors.chartColor(0)),
          pointRadius: points.map(p => p.size || 6),
          pointHoverRadius: points.map(p => (p.size || 6) + 2),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: ChartDefaults.scales({
          x: { title: { display: true, text: opts.xLabel }, ...opts.xScale },
          y: { title: { display: true, text: opts.yLabel }, ...opts.yScale },
        }),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = points[ctx.dataIndex];
                return `${p.label}: ${opts.xLabel} ${p.x?.toFixed(1)}%, ${opts.yLabel} ${p.y?.toFixed(1)}`;
              },
            },
          },
        },
      },
      plugins: [{
        // Custom plugin to draw ticker labels on points
        id: 'scatterLabels',
        afterDraw(chart) {
          const ctx = chart.ctx;
          const meta = chart.getDatasetMeta(0);
          const styles = getComputedStyle(document.documentElement);
          ctx.font = `10px ${styles.getPropertyValue('--font-mono').trim() || 'monospace'}`;
          ctx.fillStyle = styles.getPropertyValue('--text-primary').trim() || '#fff';
          ctx.textAlign = 'center';

          meta.data.forEach((point, i) => {
            const p = points[i];
            if (p && p.label) {
              ctx.fillText(p.label, point.x, point.y - 10);
            }
          });
        },
      }, ...(opts.plugins || [])],
    };

    const chart = new Chart(ctx, config);
    this._instances[canvasId] = chart;
    return chart;
  },

  destroy(canvasId) {
    if (this._instances[canvasId]) {
      this._instances[canvasId].destroy();
      delete this._instances[canvasId];
    }
  },

  destroyAll() {
    Object.keys(this._instances).forEach(id => this.destroy(id));
  },
};

window.ScatterPlot = ScatterPlot;
