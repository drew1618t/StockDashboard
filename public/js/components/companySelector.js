/**
 * companySelector.js — Company selection bar for comparison dashboards.
 * Renders portfolio checkboxes and comparison ticker input.
 */
const CompanySelector = {
  /**
   * Render the company selector bar.
   * @param {HTMLElement} container - Parent element to append into
   * @param {Object} opts
   * @param {string[]} opts.portfolioTickers - All portfolio tickers
   * @param {Set<string>} opts.deselectedTickers - Currently deselected portfolio tickers
   * @param {Object[]} opts.comparisonCompanies - Active comparison company objects
   * @param {string[]} opts.availableTickers - Non-portfolio tickers with data
   * @param {Function} opts.onToggle - Called with (ticker, checked)
   * @param {Function} opts.onAddComparison - Called with (ticker)
   * @param {Function} opts.onRemoveComparison - Called with (ticker)
   */
  render(container, opts) {
    const bar = document.createElement('div');
    bar.className = 'company-selector-bar';

    // ── Portfolio checkboxes ──
    const portSection = document.createElement('div');
    portSection.className = 'selector-section selector-portfolio';
    portSection.innerHTML = '<span class="selector-label">Portfolio</span>';

    const checkboxes = document.createElement('div');
    checkboxes.className = 'selector-checkboxes';

    opts.portfolioTickers.forEach(ticker => {
      const label = document.createElement('label');
      label.className = 'selector-checkbox';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !opts.deselectedTickers.has(ticker);
      cb.addEventListener('change', () => opts.onToggle(ticker, cb.checked));
      label.appendChild(cb);
      label.appendChild(document.createTextNode(ticker));
      checkboxes.appendChild(label);
    });

    portSection.appendChild(checkboxes);
    bar.appendChild(portSection);

    // ── Comparison input ──
    const compSection = document.createElement('div');
    compSection.className = 'selector-section selector-compare';
    compSection.innerHTML = '<span class="selector-label">Compare</span>';

    const inputRow = document.createElement('div');
    inputRow.className = 'selector-input-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'selector-ticker-input';
    input.placeholder = 'Ticker...';
    input.maxLength = 6;

    const addBtn = document.createElement('button');
    addBtn.className = 'selector-add-btn';
    addBtn.textContent = 'Add';

    const errorMsg = document.createElement('span');
    errorMsg.className = 'selector-error';

    function handleAdd() {
      const ticker = input.value.trim().toUpperCase();
      if (!ticker) return;

      errorMsg.textContent = '';

      // Already in portfolio
      if (opts.portfolioTickers.includes(ticker)) {
        errorMsg.textContent = 'Already in portfolio';
        return;
      }

      // Already added as comparison
      if (opts.comparisonCompanies.some(c => c.ticker === ticker)) {
        errorMsg.textContent = 'Already added';
        return;
      }

      // Check availability
      if (!opts.availableTickers.includes(ticker)) {
        errorMsg.textContent = `No data for ${ticker}`;
        return;
      }

      input.value = '';
      opts.onAddComparison(ticker);
    }

    addBtn.addEventListener('click', handleAdd);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAdd();
    });

    inputRow.appendChild(input);
    inputRow.appendChild(addBtn);
    inputRow.appendChild(errorMsg);
    compSection.appendChild(inputRow);

    // ── Active comparison tags ──
    if (opts.comparisonCompanies.length > 0) {
      const tags = document.createElement('div');
      tags.className = 'selector-tags';

      opts.comparisonCompanies.forEach(c => {
        const tag = document.createElement('span');
        tag.className = 'comparison-tag';
        tag.innerHTML = `${c.ticker} <button class="tag-remove" title="Remove">&times;</button>`;
        tag.querySelector('.tag-remove').addEventListener('click', () => {
          opts.onRemoveComparison(c.ticker);
        });
        tags.appendChild(tag);
      });

      compSection.appendChild(tags);
    }

    bar.appendChild(compSection);
    container.appendChild(bar);
  },
};

window.CompanySelector = CompanySelector;
