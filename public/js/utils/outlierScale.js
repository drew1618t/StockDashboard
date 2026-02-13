/**
 * outlierScale.js — Outlier detection and axis capping for Chart.js charts.
 *
 * Uses "3x gap" method: if the max value exceeds 3x the second-highest,
 * it's an outlier. Caps the axis at 1.5x the second-highest for readability.
 * Capped values are annotated with their real value on the chart.
 */
const OutlierScale = {
  /**
   * Analyze an array of numbers for outliers using the "3x gap" method.
   * @param {number[]} values - All data values (nulls filtered internally)
   * @param {Object} [opts]
   * @param {number} [opts.gapMultiplier=3] - How many times larger than next value = outlier
   * @param {number} [opts.headroom=1.5] - Cap multiplier above/below second-highest/lowest
   * @returns {{ cap: number|null, floor: number|null } | null}
   */
  analyze(values, opts = {}) {
    const gapMultiplier = opts.gapMultiplier || 3;
    const headroom = opts.headroom || 1.5;

    const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
    if (valid.length < 3) return null;

    let cap = null;
    let floor = null;

    // Check top outliers (positive values)
    const desc = [...valid].sort((a, b) => b - a);
    if (desc[0] > 0 && desc[1] > 0 && desc[0] > gapMultiplier * desc[1]) {
      cap = Math.ceil(headroom * desc[1]);
    }

    // Check bottom outliers (negative values)
    const asc = [...valid].sort((a, b) => a - b);
    if (asc[0] < 0 && asc[1] < 0 &&
        Math.abs(asc[0]) > gapMultiplier * Math.abs(asc[1])) {
      floor = Math.floor(headroom * asc[1]);
    }

    if (cap === null && floor === null) return null;
    return { cap, floor };
  },

  /**
   * Extract all Y-values from Chart.js-style datasets and compute scale overrides.
   * @param {Array<{data: number[]}>} datasets
   * @returns {{ yScale: Object, outlierInfo: Object } | null}
   */
  buildYScale(datasets) {
    const allValues = datasets.flatMap(ds => ds.data).filter(v => v != null);
    const result = this.analyze(allValues);
    if (!result) return null;

    const yScale = {};
    if (result.cap !== null) yScale.max = result.cap;
    if (result.floor !== null) yScale.min = result.floor;

    return { yScale, outlierInfo: result };
  },

  /**
   * Build scale overrides for scatter plots (both X and Y axes).
   * @param {Array<{x, y}>} points
   * @returns {{ xScale: Object|null, yScale: Object|null, outlierInfo: {x, y} } | null}
   */
  buildScatterScales(points) {
    const xVals = points.map(p => p.x).filter(v => v != null);
    const yVals = points.map(p => p.y).filter(v => v != null);
    const xResult = this.analyze(xVals);
    const yResult = this.analyze(yVals);

    if (!xResult && !yResult) return null;

    const xScale = xResult ? {} : null;
    if (xResult?.cap !== null && xResult) xScale.max = xResult.cap;
    if (xResult?.floor !== null && xResult) xScale.min = xResult.floor;

    const yScale = yResult ? {} : null;
    if (yResult?.cap !== null && yResult) yScale.max = yResult.cap;
    if (yResult?.floor !== null && yResult) yScale.min = yResult.floor;

    return {
      xScale: xScale && Object.keys(xScale).length ? xScale : null,
      yScale: yScale && Object.keys(yScale).length ? yScale : null,
      outlierInfo: { x: xResult, y: yResult },
    };
  },

  /**
   * Format a large percentage value compactly (e.g., 2500 → "2.5k%").
   */
  _fmtPct(v) {
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k%';
    return v.toFixed(0) + '%';
  },

  /**
   * Returns an inline Chart.js plugin that draws real-value annotations
   * on data points whose values were capped.
   * @param {{ cap: number|null, floor: number|null }} outlierInfo
   * @param {number[][]} originalData - original uncapped values per dataset
   */
  annotationPlugin(outlierInfo, originalData) {
    const self = this;
    return {
      id: 'outlierAnnotations',
      afterDraw(chart) {
        if (!outlierInfo) return;
        const ctx = chart.ctx;
        const styles = getComputedStyle(document.documentElement);
        const fontFamily = styles.getPropertyValue('--font-mono').trim() || 'monospace';
        const warnColor = styles.getPropertyValue('--color-warning').trim() || '#f59e0b';

        ctx.save();
        ctx.font = `bold 10px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = warnColor;

        chart.data.datasets.forEach((dataset, dsIndex) => {
          const meta = chart.getDatasetMeta(dsIndex);
          const origValues = originalData[dsIndex];
          if (!origValues) return;

          meta.data.forEach((element, index) => {
            const origVal = origValues[index];
            if (origVal === null || origVal === undefined) return;

            const isCappedHigh = outlierInfo.cap !== null && origVal > outlierInfo.cap;
            const isCappedLow = outlierInfo.floor !== null && origVal < outlierInfo.floor;
            if (!isCappedHigh && !isCappedLow) return;

            const x = element.x;
            const y = element.y;
            const text = self._fmtPct(origVal);

            if (isCappedHigh) {
              ctx.fillText('\u25B2 ' + text, x, y - 6);
            } else {
              ctx.fillText('\u25BC ' + text, x, y + 14);
            }
          });
        });

        ctx.restore();
      },
    };
  },
};

window.OutlierScale = OutlierScale;
