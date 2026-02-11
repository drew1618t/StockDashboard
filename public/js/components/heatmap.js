/**
 * heatmap.js — Revenue growth heatmap (stocks × quarters).
 */
const Heatmap = {
  /**
   * @param {HTMLElement} container
   * @param {Array<Object>} companies - Normalized company objects
   * @param {Object} [opts]
   * @param {boolean} [opts.useCalendarQuarters=false] - Use calendar quarters instead of fiscal
   */
  render(container, companies, opts = {}) {
    const useCalendar = opts.useCalendarQuarters || false;

    // Collect all unique quarters across all companies
    const quarterSet = new Set();
    const quarterCounts = {};
    companies.forEach(c => {
      (c.quarterlyHistory || []).forEach(q => {
        const label = heatmapQuarterLabel(q, useCalendar);
        quarterSet.add(label);
        if (q.revenueYoyPct != null) quarterCounts[label] = (quarterCounts[label] || 0) + 1;
      });
    });

    // Sort quarters chronologically, filtering out sparse quarters (< 2 companies)
    const quarters = [...quarterSet]
      .filter(q => (quarterCounts[q] || 0) >= 2)
      .sort(quarterSort);

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
        histMap[heatmapQuarterLabel(q, useCalendar)] = q.revenueYoyPct;
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

function heatmapQuarterLabel(q, useCalendar) {
  if (useCalendar) return (q.calendarQuarter || q.quarter).replace(' FY', ' ');
  return q.quarter.replace(' FY', ' ');
}

function quarterSort(a, b) {
  const pa = parseQuarterLabel(a);
  const pb = parseQuarterLabel(b);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.q - pb.q;
}

function parseQuarterLabel(label) {
  const m = label.match(/Q(\d)\s+(\d{4})/);
  if (m) return { q: parseInt(m[1]), year: parseInt(m[2]) };
  return { q: 0, year: 0 };
}

window.Heatmap = Heatmap;
