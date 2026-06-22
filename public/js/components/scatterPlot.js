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

    const outlierInfo = opts.outlierInfo || {};

    const capValue = (value, axisInfo) => {
      if (value == null || !axisInfo) return value;
      if (axisInfo.cap !== null && axisInfo.cap !== undefined && value > axisInfo.cap) return axisInfo.cap;
      if (axisInfo.floor !== null && axisInfo.floor !== undefined && value < axisInfo.floor) return axisInfo.floor;
      return value;
    };

    const isCapped = (p, axis) => {
      const info = outlierInfo[axis];
      const value = p[axis];
      if (value == null || !info) return false;
      return (info.cap !== null && info.cap !== undefined && value > info.cap)
        || (info.floor !== null && info.floor !== undefined && value < info.floor);
    };

    const formatAxisValue = (value, axisLabel) => {
      if (value == null) return 'N/A';
      const formatted = value.toFixed(1);
      return axisLabel.includes('%') ? `${formatted}%` : formatted;
    };

    const config = {
      type: 'scatter',
      data: {
        datasets: [{
          data: points.map(p => ({
            x: capValue(p.x, outlierInfo.x),
            y: capValue(p.y, outlierInfo.y),
          })),
          backgroundColor: points.map(p => Colors.resolveVar(p.color || Colors.chartColor(0))),
          borderColor: points.map(p => Colors.resolveVar(p.color || Colors.chartColor(0))),
          pointRadius: points.map(p => p.size || 6),
          pointHoverRadius: points.map(p => (p.size || 6) + 2),
          clip: false,
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
            backgroundColor: ChartDefaults.tooltipBg(),
            titleColor: ChartDefaults.tooltipText(),
            bodyColor: ChartDefaults.tooltipText(),
            callbacks: {
              label: (ctx) => {
                const p = points[ctx.dataIndex];
                return `${p.label}: ${opts.xLabel} ${formatAxisValue(p.x, opts.xLabel)}, ${opts.yLabel} ${formatAxisValue(p.y, opts.yLabel)}`;
              },
            },
          },
        },
      },
      plugins: [{
        // Custom plugin to draw ticker labels on points
        id: 'scatterLabels',
        afterDatasetsDraw(chart) {
          const ctx = chart.ctx;
          const meta = chart.getDatasetMeta(0);
          const styles = getComputedStyle(document.body);
          ctx.font = `10px ${styles.getPropertyValue('--font-mono').trim() || 'monospace'}`;
          ctx.fillStyle = styles.getPropertyValue('--text-primary').trim() || '#fff';
          ctx.textAlign = 'center';

          meta.data.forEach((point, i) => {
            const p = points[i];
            if (p && p.label) {
              const jumpPrefix = isCapped(p, 'x') || isCapped(p, 'y') ? '~ ' : '';
              const yOffset = isCapped(p, 'y') && p.y > outlierInfo.y?.cap ? 16 : -10;
              ctx.fillText(jumpPrefix + p.label, point.x, point.y + yOffset);
            }
          });
        },
      }, {
        id: 'scatterJumpMarkers',
        afterDraw(chart) {
          if (!outlierInfo.x && !outlierInfo.y) return;

          const ctx = chart.ctx;
          const styles = getComputedStyle(document.body);
          const warnColor = styles.getPropertyValue('--color-warning').trim() || '#f59e0b';
          const fontFamily = styles.getPropertyValue('--font-mono').trim() || 'monospace';

          ctx.save();
          ctx.strokeStyle = warnColor;
          ctx.fillStyle = warnColor;
          ctx.lineWidth = 1.5;
          ctx.font = `bold 11px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const drawSquiggle = (x, y, horizontal = true) => {
            ctx.beginPath();
            if (horizontal) {
              ctx.moveTo(x - 10, y);
              ctx.bezierCurveTo(x - 6, y - 5, x - 2, y + 5, x + 2, y);
              ctx.bezierCurveTo(x + 6, y - 5, x + 10, y + 5, x + 14, y);
            } else {
              ctx.moveTo(x, y - 10);
              ctx.bezierCurveTo(x - 5, y - 6, x + 5, y - 2, x, y + 2);
              ctx.bezierCurveTo(x - 5, y + 6, x + 5, y + 10, x, y + 14);
            }
            ctx.stroke();
          };

          const xScale = chart.scales.x;
          const yScale = chart.scales.y;
          if (outlierInfo.x?.cap !== null && outlierInfo.x?.cap !== undefined) {
            drawSquiggle(xScale.right - 16, xScale.bottom + 10, true);
          }
          if (outlierInfo.x?.floor !== null && outlierInfo.x?.floor !== undefined) {
            drawSquiggle(xScale.left + 16, xScale.bottom + 10, true);
          }
          if (outlierInfo.y?.cap !== null && outlierInfo.y?.cap !== undefined) {
            drawSquiggle(yScale.left - 10, yScale.top + 16, false);
          }
          if (outlierInfo.y?.floor !== null && outlierInfo.y?.floor !== undefined) {
            drawSquiggle(yScale.left - 10, yScale.bottom - 16, false);
          }

          const meta = chart.getDatasetMeta(0);
          meta.data.forEach((point, i) => {
            const p = points[i];
            if (!p || (!isCapped(p, 'x') && !isCapped(p, 'y'))) return;

            const values = [];
            if (isCapped(p, 'x')) values.push(formatAxisValue(p.x, opts.xLabel));
            if (isCapped(p, 'y')) values.push(formatAxisValue(p.y, opts.yLabel));
            const yAnnotationOffset = isCapped(p, 'y') && p.y > outlierInfo.y?.cap ? 32 : -24;
            ctx.fillText(`~ ${values.join(', ')}`, point.x, point.y + yAnnotationOffset);
          });

          ctx.restore();
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
