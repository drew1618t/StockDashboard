/**
 * heatmap.js — Revenue growth heatmap (stocks × quarters).
 */
const Heatmap = {
  /**
   * @param {HTMLElement} container
   * @param {Array<Object>} companies - Normalized company objects
   */
  render(container, companies) {
    // Collect all unique quarters across all companies
    const quarterSet = new Set();
    companies.forEach(c => {
      (c.quarterlyHistory || []).forEach(q => quarterSet.add(q.quarter));
    });

    // Sort quarters chronologically
    const quarters = [...quarterSet].sort((a, b) => {
      const [qa, ya] = a.replace('Q', '').split(' ');
      const [qb, yb] = b.replace('Q', '').split(' ');
      return (ya + qa).localeCompare(yb + qb);
    });

    if (quarters.length === 0) {
      container.innerHTML = '<div class="empty-state">No quarterly history data available</div>';
      return;
    }

    // Build grid
    const wrapper = document.createElement('div');
    wrapper.className = 'heatmap-wrapper';

    // Header row
    let headerHtml = '<div class="heatmap-cell heatmap-corner">Ticker</div>';
    quarters.forEach(q => {
      headerHtml += `<div class="heatmap-cell heatmap-header">${q}</div>`;
    });

    // Data rows
    let rowsHtml = '';
    companies.forEach(company => {
      const histMap = {};
      (company.quarterlyHistory || []).forEach(q => {
        histMap[q.quarter] = q.revenueYoyPct;
      });

      let row = `<div class="heatmap-cell heatmap-ticker">${company.ticker}</div>`;
      quarters.forEach(q => {
        const val = histMap[q];
        const bgColor = Colors.heatmapColor(val);
        const display = val !== null && val !== undefined ? Fmt.pct(val) : '';
        const textColor = val !== null && val >= 50 ? 'var(--heatmap-text-light)' : 'var(--heatmap-text-dark)';
        row += `<div class="heatmap-cell heatmap-value" style="background:${bgColor};color:${textColor}" title="${company.ticker} ${q}: ${display || 'N/A'}">${display}</div>`;
      });
      rowsHtml += `<div class="heatmap-row">${row}</div>`;
    });

    wrapper.innerHTML = `
      <div class="heatmap-grid" style="grid-template-columns: 80px repeat(${quarters.length}, 1fr)">
        <div class="heatmap-row heatmap-header-row">${headerHtml}</div>
        ${rowsHtml}
      </div>
    `;

    container.appendChild(wrapper);
  },
};

window.Heatmap = Heatmap;
