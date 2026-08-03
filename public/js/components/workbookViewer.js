/**
 * workbookViewer.js - Read-only, family-only workbook sheet viewer.
 */
const WorkbookViewer = {
  pageSize: 100,

  render(container, workbook, options = {}) {
    const sheets = workbook?.sheets || [];
    const section = document.createElement('section');
    section.className = 'section private-workbook-viewer';
    if (!sheets.length) {
      section.innerHTML = '<div class="error-state">Workbook sheets are not available.</div>';
      container.appendChild(section);
      return section;
    }

    section.innerHTML = `
      <div class="private-workbook-viewer-heading">
        <div>
          <h2 class="section-title">Complete Workbook</h2>
          <p>Choose a worksheet tab to view its complete contents. Large sheets are divided into pages of ${this.pageSize} rows.</p>
        </div>
      </div>
      <nav class="private-sheet-tabs" role="tablist" aria-label="${this._escape(options.title || 'Workbook')} worksheets"></nav>
      <div class="private-sheet-panel"></div>
    `;

    const tabList = section.querySelector('.private-sheet-tabs');
    const panel = section.querySelector('.private-sheet-panel');
    let activeSheet = 0;
    let activePage = 0;

    const renderSheet = () => {
      this._renderSheet(panel, sheets[activeSheet], activePage, nextPage => {
        activePage = nextPage;
        renderSheet();
      });
      tabList.querySelectorAll('button').forEach((button, index) => {
        const active = index === activeSheet;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
    };

    sheets.forEach((sheet, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.innerHTML = `${this._escape(sheet.name)} <small>${sheet.rowCount}&times;${sheet.columnCount}</small>`;
      button.addEventListener('click', () => {
        activeSheet = index;
        activePage = 0;
        renderSheet();
      });
      tabList.appendChild(button);
    });

    renderSheet();
    container.appendChild(section);
    return section;
  },

  _renderSheet(panel, sheet, page, onPageChange) {
    const totalPages = Math.max(1, Math.ceil(sheet.rowCount / this.pageSize));
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * this.pageSize;
    const end = Math.min(start + this.pageSize, sheet.rowCount);
    const rows = sheet.values.slice(start, end);

    panel.innerHTML = `
      <div class="private-sheet-toolbar">
        <div>
          <strong>${this._escape(sheet.name)}</strong>
          <span>${this._escape(sheet.address)} &middot; rows ${start + 1}&ndash;${end} of ${sheet.rowCount}</span>
        </div>
        ${totalPages > 1 ? `
          <div class="private-sheet-pager">
            <button type="button" data-page="${safePage - 1}" ${safePage === 0 ? 'disabled' : ''}>&larr; Previous</button>
            <span>Page ${safePage + 1} of ${totalPages}</span>
            <button type="button" data-page="${safePage + 1}" ${safePage === totalPages - 1 ? 'disabled' : ''}>Next &rarr;</button>
          </div>
        ` : ''}
      </div>
      <div class="private-sheet-scroll" tabindex="0" aria-label="${this._escape(sheet.name)} worksheet">
        <table class="private-sheet-grid">
          <thead><tr><th class="private-sheet-corner"></th>${Array.from({ length: sheet.columnCount }, (_, index) => `<th>${this._columnName(index)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((row, offset) => this._renderRow(sheet, row, start + offset)).join('')}</tbody>
        </table>
      </div>
    `;

    panel.querySelectorAll('.private-sheet-pager button').forEach(button => {
      button.addEventListener('click', () => onPageChange(Number(button.dataset.page)));
    });
  },

  _renderRow(sheet, row, rowIndex) {
    const kind = this._rowKind(row);
    const cells = [];
    for (let columnIndex = 0; columnIndex < sheet.columnCount;) {
      const value = row[columnIndex] ?? null;
      let span = 1;
      if (value !== null && value !== '') {
        while (columnIndex + span < sheet.columnCount && row[columnIndex + span] === value) span += 1;
      }
      const formatted = this._formatValue(value, this._columnContext(sheet.values, rowIndex, columnIndex));
      const numericClass = typeof value === 'number'
        ? value > 0 ? ' numeric positive-value' : value < 0 ? ' numeric negative-value' : ' numeric'
        : '';
      cells.push(`<td class="${kind}${numericClass}"${span > 1 ? ` colspan="${span}"` : ''}>${this._escape(formatted)}</td>`);
      columnIndex += span;
    }
    return `<tr><th class="private-sheet-row-number">${rowIndex + 1}</th>${cells.join('')}</tr>`;
  },

  _rowKind(row) {
    const populated = row.filter(value => value !== null && value !== '').length;
    if (!populated) return 'blank-cell';
    const strings = row.filter(value => typeof value === 'string' && value !== '');
    const numbers = row.filter(value => typeof value === 'number');
    const mostRepeated = strings.reduce((max, value) => Math.max(max, row.filter(cell => cell === value).length), 0);
    if (mostRepeated >= Math.max(3, Math.ceil(row.length / 2))) return 'title-cell';
    if (strings.length >= 2 && numbers.length === 0 && strings.every(value => value.length < 80)) return 'header-cell';
    return 'body-cell';
  },

  _columnContext(values, rowIndex, columnIndex) {
    for (let index = rowIndex - 1; index >= 0; index -= 1) {
      const row = values[index] || [];
      const candidate = row[columnIndex];
      const strings = row.filter(value => typeof value === 'string' && value !== '');
      const numbers = row.filter(value => typeof value === 'number');
      if (typeof candidate === 'string' && strings.length >= 2 && numbers.length === 0 && candidate.length < 80) {
        return candidate;
      }
    }
    return '';
  },

  _formatValue(value, context) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)) return value.slice(0, 10);
      return value;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);

    const label = String(context).toLowerCase();
    if (/(date|as-of|as of)/.test(label) && Number.isInteger(value) && value > 30000 && value < 70000) {
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
      return date.toISOString().slice(0, 10);
    }
    if (/(return|drawdown|capture|weight|margin|growth|rate|pre-entry|difference %|percent|quartile cutoff)/.test(label)) {
      return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
    }
    if (/(price|value|cost|amount|cash|income|proceeds|purchase|sales|fees|buy \$|p\/l|portfolio|equity)/.test(label)) {
      return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
    }
    return value.toLocaleString('en-US', {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 4,
    });
  },

  _columnName(index) {
    let value = index + 1;
    let name = '';
    while (value > 0) {
      value -= 1;
      name = String.fromCharCode(65 + (value % 26)) + name;
      value = Math.floor(value / 26);
    }
    return name;
  },

  _escape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};

window.WorkbookViewer = WorkbookViewer;
