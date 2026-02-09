/**
 * sortableTable.js — Renders a sortable data table with clickable column headers.
 */
const SortableTable = {
  /**
   * @param {HTMLElement} container - Where to render
   * @param {Object} opts
   * @param {Array<{key, label, format?, align?, sortable?}>} opts.columns
   * @param {Array<Object>} opts.data - Row data objects
   * @param {string} [opts.defaultSort] - Column key to sort by initially
   * @param {string} [opts.defaultDir] - 'asc' or 'desc'
   * @param {Function} [opts.onRowClick] - Callback when a row is clicked
   */
  render(container, opts) {
    const { columns, data, defaultSort, defaultDir = 'desc', onRowClick } = opts;
    let sortKey = defaultSort || (columns[0] && columns[0].key);
    let sortDir = defaultDir;
    let sortedData = [...data];

    const table = document.createElement('div');
    table.className = 'sortable-table-wrapper';

    function doSort() {
      sortedData = [...data].sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        // Handle nulls
        if (av === null || av === undefined || av === 'N/A') av = sortDir === 'asc' ? Infinity : -Infinity;
        if (bv === null || bv === undefined || bv === 'N/A') bv = sortDir === 'asc' ? Infinity : -Infinity;
        // Numeric comparison
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        // String comparison
        return sortDir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
      renderTable();
    }

    function renderTable() {
      const headerHtml = columns.map(col => {
        const sortable = col.sortable !== false;
        const arrow = sortKey === col.key ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
        const cls = [
          'th',
          col.align === 'right' ? 'text-right' : '',
          sortable ? 'sortable' : '',
        ].filter(Boolean).join(' ');
        return `<div class="${cls}" data-key="${col.key}">${col.label}${arrow}</div>`;
      }).join('');

      const rowsHtml = sortedData.map((row, i) => {
        const cells = columns.map(col => {
          let val = row[col.key];
          if (col.format) val = col.format(val, row);
          else if (val === null || val === undefined) val = 'N/A';
          const cls = col.align === 'right' ? 'text-right' : '';
          return `<div class="td ${cls}">${val}</div>`;
        }).join('');
        return `<div class="tr" data-index="${i}" data-ticker="${row.ticker || ''}">${cells}</div>`;
      }).join('');

      table.innerHTML = `
        <div class="table-grid" style="grid-template-columns: ${columns.map(c => c.width || '1fr').join(' ')}">
          <div class="thead">${headerHtml}</div>
          <div class="tbody">${rowsHtml}</div>
        </div>
      `;

      // Header click handlers
      table.querySelectorAll('.th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.key;
          if (sortKey === key) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            sortKey = key;
            sortDir = 'desc';
          }
          doSort();
        });
      });

      // Row click handlers
      if (onRowClick) {
        table.querySelectorAll('.tr').forEach(tr => {
          tr.style.cursor = 'pointer';
          tr.addEventListener('click', () => {
            const idx = parseInt(tr.dataset.index);
            onRowClick(sortedData[idx]);
          });
        });
      }
    }

    doSort();
    container.appendChild(table);
    return table;
  },
};

window.SortableTable = SortableTable;
