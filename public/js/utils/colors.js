/**
 * colors.js — Color scales and growth tier color mappings.
 */
const Colors = {
  /** Growth tier color based on YoY revenue growth % */
  growthTier(pct) {
    if (pct === null || pct === undefined) return { color: '#6b7280', label: 'N/A', tier: 'na' };
    if (pct >= 50) return { color: 'var(--color-growth-hot)', label: '>50%', tier: 'hot' };
    if (pct >= 35) return { color: 'var(--color-growth-strong)', label: '35-50%', tier: 'strong' };
    if (pct >= 25) return { color: 'var(--color-growth-moderate)', label: '25-35%', tier: 'moderate' };
    if (pct >= 0) return { color: 'var(--color-growth-slow)', label: '0-25%', tier: 'slow' };
    return { color: 'var(--color-growth-negative)', label: '<0%', tier: 'negative' };
  },

  /** Heatmap cell color for growth values */
  heatmapColor(pct) {
    if (pct === null || pct === undefined) return 'var(--bg-tertiary)';
    if (pct >= 100) return 'var(--heatmap-100)';
    if (pct >= 50) return 'var(--heatmap-50)';
    if (pct >= 35) return 'var(--heatmap-35)';
    if (pct >= 25) return 'var(--heatmap-25)';
    if (pct >= 10) return 'var(--heatmap-10)';
    if (pct >= 0) return 'var(--heatmap-0)';
    return 'var(--heatmap-neg)';
  },

  /** Verdict color */
  verdictColor(verdict) {
    if (!verdict) return 'var(--text-muted)';
    const v = verdict.toUpperCase();
    if (v === 'PASS' || v === 'STRONG PASS') return 'var(--color-positive)';
    if (v === 'CAUTION' || v === 'WATCH') return 'var(--color-warning)';
    if (v === 'FAIL' || v === 'DISQUALIFIED') return 'var(--color-negative)';
    return 'var(--text-muted)';
  },

  /** Chart color palette for multiple series */
  chartPalette: [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#e11d48',
  ],

  /** Get chart color by index */
  chartColor(index) {
    return Colors.chartPalette[index % Colors.chartPalette.length];
  },

  /** Muted gray palette for comparison (non-portfolio) companies */
  comparisonPalette: [
    '#9ca3af', '#6b7280', '#a1a1aa', '#78716c', '#737373',
    '#8b8b8b', '#a3a3a3', '#7c7c7c', '#999999', '#858585',
  ],

  /** Get comparison color by index */
  comparisonColor(index) {
    return Colors.comparisonPalette[index % Colors.comparisonPalette.length];
  },

  /** Build a ticker→color map for a mixed list of portfolio + comparison companies */
  buildColorMap(companies) {
    const map = {};
    let portIdx = 0, compIdx = 0;
    companies.forEach(c => {
      map[c.ticker] = c._isComparison
        ? Colors.comparisonColor(compIdx++)
        : Colors.chartColor(portIdx++);
    });
    return map;
  },
};

window.Colors = Colors;
