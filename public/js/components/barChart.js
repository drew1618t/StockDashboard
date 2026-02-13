/**
 * barChart.js — Wrapper for Chart.js bar charts.
 */
const BarChart = {
  /** Track active chart instances for cleanup */
  _instances: {},

  /**
   * @param {string} canvasId - Canvas element ID
   * @param {Object} opts
   * @param {string[]} opts.labels
   * @param {Array<{label, data, color?}>} opts.datasets
   * @param {boolean} [opts.horizontal] - Horizontal bars
   * @param {string} [opts.yLabel]
   * @param {Function} [opts.tooltipFormat] - Custom tooltip formatter
   */
  render(canvasId, opts) {
    this.destroy(canvasId);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    const datasets = opts.datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.colors || ds.color || Colors.chartColor(i),
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 3,
      barPercentage: 0.7,
      categoryPercentage: 0.8,
    }));

    const config = {
      type: 'bar',
      data: { labels: opts.labels, datasets },
      options: {
        indexAxis: opts.horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        scales: ChartDefaults.scales({
          y: {
            ...(opts.yLabel ? { title: { display: true, text: opts.yLabel } } : {}),
            ...opts.yScale,
          },
        }),
        plugins: {
          legend: { display: datasets.length > 1 },
          tooltip: opts.tooltipFormat ? {
            callbacks: { label: opts.tooltipFormat }
          } : {},
        },
      },
      plugins: opts.plugins || [],
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

window.BarChart = BarChart;
