/**
 * peCompression.js — Visual P/E compression/expansion waterfall.
 */
const PeCompression = {
  /**
   * @param {HTMLElement} container
   * @param {Object} peData - { trailingPe, runRatePe, forwardPe, trailingToRunRate, runRateToForward }
   */
  render(container, peData) {
    if (!peData) {
      container.innerHTML = '<div class="empty-state">P/E data not available</div>';
      return;
    }

    const stages = [
      { label: 'Trailing P/E', value: peData.trailingPe },
      { label: 'Run Rate P/E', value: peData.runRatePe },
      { label: 'Forward P/E', value: peData.forwardPe },
    ].filter(s => s.value !== null && s.value !== undefined);

    if (stages.length === 0) {
      container.innerHTML = '<div class="empty-state">No P/E ratios available</div>';
      return;
    }

    const maxVal = Math.max(...stages.map(s => s.value));

    const wrapper = document.createElement('div');
    wrapper.className = 'pe-compression-wrapper';

    let html = '<div class="pe-compression-flow">';

    stages.forEach((stage, i) => {
      const pct = (stage.value / maxVal) * 100;
      const isLast = i === stages.length - 1;

      html += `
        <div class="pe-stage">
          <div class="pe-stage-label">${stage.label}</div>
          <div class="pe-stage-bar-wrapper">
            <div class="pe-stage-bar" style="width: ${pct}%"></div>
          </div>
          <div class="pe-stage-value">${Fmt.multiple(stage.value)}</div>
        </div>
      `;

      // Arrow between stages showing compression
      if (!isLast && stages[i + 1]) {
        const delta = stage.value - stages[i + 1].value;
        const isCompression = delta > 0;
        html += `
          <div class="pe-arrow ${isCompression ? 'pe-compression' : 'pe-expansion'}">
            ${isCompression ? '\u25BC' : '\u25B2'} ${Math.abs(delta).toFixed(1)}x ${isCompression ? 'compression' : 'expansion'}
          </div>
        `;
      }
    });

    html += '</div>';

    // Total compression summary
    if (peData.trailingPe && peData.forwardPe) {
      const total = peData.trailingPe - peData.forwardPe;
      const cls = total > 0 ? 'pe-compression' : 'pe-expansion';
      html += `
        <div class="pe-total ${cls}">
          Total: ${Math.abs(total).toFixed(1)}x ${total > 0 ? 'compression' : 'expansion'}
          (${peData.trailingPe.toFixed(1)}x \u2192 ${peData.forwardPe.toFixed(1)}x)
        </div>
      `;
    }

    wrapper.innerHTML = html;
    container.appendChild(wrapper);
  },
};

window.PeCompression = PeCompression;
