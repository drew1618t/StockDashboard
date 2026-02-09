/**
 * metricCard.js — Renders a single metric card with label, value, and optional subtext.
 */
const MetricCard = {
  /**
   * @param {Object} opts
   * @param {string} opts.label - Card title
   * @param {string} opts.value - Main display value
   * @param {string} [opts.subtext] - Secondary text below value
   * @param {string} [opts.colorClass] - CSS class for value color
   * @param {string} [opts.icon] - Optional icon/symbol
   */
  render(opts) {
    const div = document.createElement('div');
    div.className = 'metric-card';
    if (opts.colorClass) div.classList.add(opts.colorClass);

    div.innerHTML = `
      <div class="metric-label">${opts.label}</div>
      <div class="metric-value">${opts.value}</div>
      ${opts.subtext ? `<div class="metric-subtext">${opts.subtext}</div>` : ''}
    `;
    return div;
  },

  /** Render a row of metric cards into a container */
  renderRow(container, cards) {
    const row = document.createElement('div');
    row.className = 'metric-cards-row';
    cards.forEach(card => row.appendChild(this.render(card)));
    container.appendChild(row);
    return row;
  },
};

window.MetricCard = MetricCard;
