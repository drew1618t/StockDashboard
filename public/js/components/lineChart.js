/**
 * lineChart.js — Wrapper for Chart.js line charts.
 */
const LineChart = {
  _instances: {},

  /**
   * @param {string} canvasId
   * @param {Object} opts
   * @param {string[]} opts.labels - X-axis labels
   * @param {Array<{label, data, color?, dashed?}>} opts.datasets
   * @param {string} [opts.yLabel]
   * @param {boolean} [opts.fill] - Fill area under line
   */
  render(canvasId, opts) {
    this.destroy(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const datasets = opts.datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color || Colors.chartColor(i),
      backgroundColor: opts.fill
        ? (ds.color || Colors.chartColor(i)) + '20'
        : 'transparent',
      fill: opts.fill || false,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
      borderDash: ds.dashed ? [5, 5] : [],
    }));

    const config = {
      type: 'line',
      data: { labels: opts.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: ChartDefaults.scales({
          y: opts.yLabel ? { title: { display: true, text: opts.yLabel } } : {},
        }),
        plugins: {
          legend: { display: datasets.length > 1, position: 'top' },
          tooltip: {
            itemSort: (a, b) => (b.parsed.y ?? -Infinity) - (a.parsed.y ?? -Infinity),
          },
        },
      },
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

window.LineChart = LineChart;
