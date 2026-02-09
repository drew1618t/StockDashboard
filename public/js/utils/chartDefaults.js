/**
 * chartDefaults.js — Chart.js configuration defaults per theme.
 */
const ChartDefaults = {
  /** Apply theme-specific defaults to Chart.js global config */
  applyTheme(themeName) {
    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--text-primary').trim() || '#c8d0e0';
    const textMuted = styles.getPropertyValue('--text-muted').trim() || '#666';
    const gridColor = styles.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.08)';
    const fontFamily = styles.getPropertyValue('--font-numbers').trim() || 'monospace';

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
    Chart.defaults.font.family = fontFamily;
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.labels.color = textColor;
    Chart.defaults.plugins.legend.labels.font = { family: fontFamily, size: 11 };
    Chart.defaults.plugins.tooltip.backgroundColor = styles.getPropertyValue('--bg-card').trim() || '#1a2035';
    Chart.defaults.plugins.tooltip.titleColor = textColor;
    Chart.defaults.plugins.tooltip.bodyColor = textColor;
    Chart.defaults.plugins.tooltip.borderColor = styles.getPropertyValue('--border-color').trim() || '#2a3450';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.cornerRadius = parseInt(styles.getPropertyValue('--border-radius')) || 4;
    Chart.defaults.plugins.tooltip.padding = 8;

    // Disable animations for performance on Pi
    Chart.defaults.animation = false;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
  },

  /** Common scales config */
  scales(opts = {}) {
    const styles = getComputedStyle(document.documentElement);
    const gridColor = styles.getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.08)';
    const textColor = styles.getPropertyValue('--text-secondary').trim() || '#666';

    return {
      x: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: textColor, font: { size: 10 } },
        ...opts.x,
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: textColor, font: { size: 10 } },
        ...opts.y,
      },
    };
  },
};

window.ChartDefaults = ChartDefaults;
