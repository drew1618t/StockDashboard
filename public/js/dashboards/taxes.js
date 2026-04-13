/**
 * taxes.js - Family-only tax dashboard.
 * Uses Schwab position exports plus FIFO-estimated transaction history.
 */
const TaxesDashboard = {
  _data: null,

  async render(container) {
    container.innerHTML = '';
    this._data = await API.getTaxes();

    const section = document.createElement('div');
    section.className = 'dashboard taxes-dashboard';

    this._renderHeader(section, this._data);
    this._renderMetrics(section, this._data);
    this._renderTermBreakdown(section, this._data);
    this._renderPlanner(section, this._data);
    this._renderPositions(section, this._data);
    this._renderAttention(section, this._data);
    this._renderSales(section, this._data);
    this._renderCarryover(section, this._data);

    section.addEventListener('click', event => this._handleClick(event, container));
    container.appendChild(section);
  },

  _renderHeader(section, data) {
    const header = document.createElement('div');
    header.className = 'section';
    header.innerHTML = `
      <h2 class="section-title">Taxes</h2>
    `;
    section.appendChild(header);
  },

  _renderMetrics(section, data) {
    const m = data.summary;
    const planner = data.planner?.computed || {};
    const plannerInputs = data.planner?.inputs || {};
    const plannedConversion = Number(plannerInputs.plannedRothConversion || 0);
    const limit = Number(planner.headroomNoOrdinaryTax || 0);
    const remaining = Math.max(0, limit - plannedConversion);
    const metricsRow = document.createElement('div');
    metricsRow.className = 'section';
    MetricCard.renderRow(metricsRow, [
      {
        label: '0% Headroom Remaining',
        value: this._money(remaining),
        subtext: `${this._money(limit)} limit, ${this._money(plannedConversion)} planned`,
        colorClass: remaining ? 'positive' : 'neutral',
      },
      {
        label: 'Current Unrealized',
        value: this._money(m.currentUnrealizedGainLoss),
        subtext: `${this._money(m.currentMarketValue)} market value`,
        colorClass: this._gainClass(m.currentUnrealizedGainLoss),
      },
      {
        label: 'Realized FIFO YTD',
        value: this._money(m.realizedGainLossEstimate),
        subtext: `${this._money(m.realizedProceeds)} proceeds`,
        colorClass: this._gainClass(m.realizedGainLossEstimate),
      },
      {
        label: 'Confirmed Realized YTD',
        value: this._money(m.confirmedRealizedGainLoss),
        subtext: `${this._money(m.unconfirmedRealizedGainLoss)} unconfirmed est.`,
        colorClass: this._gainClass(m.confirmedRealizedGainLoss),
      },
    ]);
    section.appendChild(metricsRow);
  },

  _renderTermBreakdown(section, data) {
    const current = data.summary.currentTermBreakdown || {};
    const realized = data.summary.realizedTermBreakdown || {};
    const el = document.createElement('div');
    el.className = 'section tax-term-breakdown';
    el.innerHTML = `
      <h2 class="section-title">Short vs Long Term</h2>
      <div class="tax-note">Short = held 365 days or less. Long = more than 365 days. (FIFO lots, as-of Schwab export.)</div>
      <div class="tax-term-grid">
        ${this._termCard('Current short-term unrealized', current.shortTerm?.unrealizedGainLoss, current.shortTerm?.marketValue)}
        ${this._termCard('Current long-term unrealized', current.longTerm?.unrealizedGainLoss, current.longTerm?.marketValue)}
        ${this._termCard('Realized short-term FIFO', realized.shortTerm?.gainLossEstimate, realized.shortTerm?.proceeds)}
        ${this._termCard('Realized long-term FIFO', realized.longTerm?.gainLossEstimate, realized.longTerm?.proceeds)}
      </div>
    `;
    section.appendChild(el);
  },

  _renderPlanner(section, data) {
    const inputs = data.planner?.inputs || {};
    const computed = data.planner?.computed || {};
    const el = document.createElement('div');
    el.className = 'section';
    const marginalPct = computed.marginalRate == null ? null : computed.marginalRate * 100;
    const conversion = Number(inputs.plannedRothConversion || 0);
    const headroom = Number(computed.headroomNoOrdinaryTax || 0);
    const remainingHeadroom = Math.max(0, headroom - conversion);
    el.innerHTML = `
      <h2 class="section-title">Roth Conversion Planner</h2>
      <div class="tax-planner-grid">
        <div class="tax-control-row">
          <label for="tax-filing-status">Filing</label>
          <select id="tax-filing-status">
            ${this._statusOption('mfj', 'MFJ', inputs.filingStatus)}
            ${this._statusOption('single', 'Single', inputs.filingStatus)}
            ${this._statusOption('hoh', 'HOH', inputs.filingStatus)}
            ${this._statusOption('mfs', 'MFS', inputs.filingStatus)}
          </select>

          <label for="tax-income-annual">Annual taxable</label>
          <input id="tax-income-annual" type="number" step="0.01" value="${this._escapeAttr(String(inputs.taxableOrdinaryIncomeAnnual ?? 0))}">

          <label for="tax-deduction">Deduction</label>
          <input id="tax-deduction" type="number" step="1" value="${this._escapeAttr(String(inputs.standardDeduction ?? 0))}">

          <label for="tax-conversion">Conversion</label>
          <input id="tax-conversion" type="number" step="0.01" value="${this._escapeAttr(String(inputs.plannedRothConversion ?? 0))}">

          <label for="tax-realized-mode">Realized mode</label>
          <select id="tax-realized-mode">
            ${this._statusOption('confirmed_or_estimate', 'Confirmed + Est', inputs.realizedMode)}
            ${this._statusOption('confirmed_only', 'Confirmed only', inputs.realizedMode)}
          </select>

          <button class="tax-action-btn" data-action="save-planner">Save</button>
        </div>
      </div>
      <div class="tax-note" style="margin-top: 8px;">
        0% conversion limit: <b>${this._escape(this._money(computed.headroomNoOrdinaryTax))}</b>
        (${this._escape(this._money(remainingHeadroom))} remaining after ${this._escape(this._money(conversion))} planned).
        Capital loss offset used: ${this._escape(this._money(computed.capLossOffsetUsed || 0))}.
        Short-term ordinary added: ${this._escape(this._money(computed.shortTermAfterNetting || 0))}.
      </div>
      <div class="tax-term-grid" style="margin-top: var(--gap);">
        ${this._metricCard('0% conversion limit', this._money(computed.headroomNoOrdinaryTax), `Ordinary ${this._money(computed.ordinaryIncomeEstimate)}`)}
        ${this._metricCard('Remaining at 0%', this._money(remainingHeadroom), `After ${this._money(conversion)} planned`)}
        ${this._metricCard('Marginal rate (ordinary)', marginalPct == null ? 'N/A' : Fmt.pct(marginalPct, true), computed.headroomToNextBracket == null ? 'Next bracket N/A' : `${this._money(computed.headroomToNextBracket)} to next bracket`)}
        ${this._metricCard('Tax before (est.)', this._money(computed.estimatedTaxBefore), `Taxable ${this._money(computed.taxableOrdinaryBefore)}`)}
        ${this._metricCard('Conversion tax add (est.)', this._money(computed.incrementalTax), `Taxable ${this._money(computed.taxableOrdinaryAfter)}`)}
      </div>
      <div class="tax-note" style="margin-top: 8px;">
        Uses ordinary brackets only. Short-term gains increase ordinary income. Net capital losses reduce ordinary income up to $3,000.
      </div>
    `;
    section.appendChild(el);
  },

  _metricCard(label, value, subtext) {
    return `
      <div class="tax-term-card">
        <div class="metric-label">${this._escape(label)}</div>
        <div class="metric-value">${this._escape(String(value ?? ''))}</div>
        <div class="metric-subtext">${this._escape(String(subtext ?? ''))}</div>
      </div>
    `;
  },

  _statusOption(value, label, current) {
    const selected = String(value) === String(current) ? 'selected' : '';
    return `<option value="${this._escapeAttr(value)}" ${selected}>${this._escape(label)}</option>`;
  },

  _termCard(label, gainLoss, value) {
    return `
      <div class="tax-term-card">
        <div class="metric-label">${this._escape(label)}</div>
        <div class="metric-value ${this._gainTextClass(gainLoss)}">${this._money(gainLoss || 0)}</div>
        <div class="metric-subtext">${this._money(value || 0)} value/proceeds</div>
      </div>
    `;
  },

  _renderCarryover(section, data) {
    const el = document.createElement('div');
    el.className = 'section tax-controls';
    el.innerHTML = `
      <h2 class="section-title">Carryover Losses</h2>
      <div class="tax-control-row">
        <label for="tax-carryover-input">Loss carryover</label>
        <input id="tax-carryover-input" type="number" step="0.01" value="${this._escape(String(data.summary.carryoverLossEnteringYear || 0))}">
        <button class="tax-action-btn" data-action="save-carryover">Save</button>
      </div>
    `;
    section.appendChild(el);
  },

  _renderAttention(section, data) {
    const el = document.createElement('div');
    el.className = 'section';
    el.innerHTML = '<h2 class="section-title">Needs Confirmation</h2>';

    const panel = document.createElement('div');
    panel.className = 'tax-attention';
    if (!data.attentionItems.length) {
      panel.innerHTML = '<div class="alert alert-info">No tax rows need confirmation.</div>';
    } else {
      panel.innerHTML = data.attentionItems.map(item => `
        <div class="tax-attention-item">
          <span class="alert-ticker">${this._escape(item.ticker)}</span>
          <span>${this._escape(item.message)}</span>
          <span class="${this._gainTextClass(item.sale.gainLossEstimate)}">${this._money(item.sale.gainLossEstimate)}</span>
        </div>
      `).join('');
    }
    el.appendChild(panel);
    section.appendChild(el);
  },

  _renderPositions(section, data) {
    const el = document.createElement('div');
    el.className = 'section';
    el.innerHTML = '<h2 class="section-title">Current Positions</h2>';

    SortableTable.render(el, {
      columns: [
        { key: 'ticker', label: 'Ticker', width: '70px' },
        { key: 'quantity', label: 'Qty', format: v => Fmt.num(v, 0), align: 'right', width: '70px' },
        { key: 'shortQuantity', label: 'Short sh', format: v => Fmt.num(v || 0, 0), align: 'right', width: '85px' },
        { key: 'longQuantity', label: 'Long sh', format: v => Fmt.num(v || 0, 0), align: 'right', width: '85px' },
        { key: 'shortUnrealizedGainLoss', label: 'Short P/L', format: v => `<span class="${this._gainTextClass(v)}">${this._money(v || 0)}</span>`, align: 'right', width: '105px' },
        { key: 'longUnrealizedGainLoss', label: 'Long P/L', format: v => `<span class="${this._gainTextClass(v)}">${this._money(v || 0)}</span>`, align: 'right', width: '105px' },
        { key: 'acquiredDate', label: 'Acquired', format: v => v || 'N/A', width: '105px' },
        { key: 'holdingTerm', label: 'Term', format: v => this._termPill(v), width: '90px' },
        { key: 'nextLongTermDate', label: 'Long On', format: v => v || 'Already long', width: '110px' },
        { key: 'marketValue', label: 'Value', format: v => this._money(v), align: 'right', width: '105px' },
        { key: 'costBasis', label: 'Cost', format: v => this._money(v), align: 'right', width: '105px' },
        { key: 'unrealizedGainLoss', label: 'Unrealized', format: v => `<span class="${this._gainTextClass(v)}">${this._money(v)}</span>`, align: 'right', width: '110px' },
        { key: 'unrealizedGainLossPct', label: 'Unreal %', format: v => Fmt.pct(v, true), align: 'right', width: '80px' },
        { key: '_lots', label: 'Lots', format: (_, row) => this._lotSummary(row.lots), width: '240px', sortable: false },
      ],
      data: data.positions,
      defaultSort: 'unrealizedGainLoss',
    });

    section.appendChild(el);
  },

  _renderSales(section, data) {
    const el = document.createElement('div');
    el.className = 'section';
    el.innerHTML = '<h2 class="section-title">Realized Sales</h2>';

    SortableTable.render(el, {
      columns: [
        { key: 'date', label: 'Date', width: '95px' },
        { key: 'ticker', label: 'Ticker', width: '70px' },
        { key: 'quantity', label: 'Qty', format: v => Fmt.num(v, 0), align: 'right', width: '70px' },
        { key: 'proceeds', label: 'Proceeds', format: v => this._money(v), align: 'right', width: '105px' },
        { key: 'costBasis', label: 'FIFO Cost', format: v => v == null ? 'Needs data' : this._money(v), align: 'right', width: '105px' },
        { key: 'gainLossEstimate', label: 'FIFO P/L', format: v => `<span class="${this._gainTextClass(v)}">${this._money(v)}</span>`, align: 'right', width: '105px' },
        { key: 'holdingTerm', label: 'Term', format: v => this._termPill(v), width: '90px' },
        { key: 'needsConfirmation', label: 'Status', format: (_, row) => this._statusPill(row), width: '120px', sortable: false },
        { key: '_confirm', label: 'Confirm', format: (_, row) => this._saleActions(row), width: '250px', sortable: false },
      ],
      data: data.realizedSales,
      defaultSort: 'date',
      defaultDir: 'asc',
    });

    section.appendChild(el);
  },

  async _handleClick(event, container) {
    const action = event.target?.dataset?.action;
    if (!action) return;

    if (action === 'save-planner') {
      const filingStatus = document.getElementById('tax-filing-status')?.value || 'mfj';
      const taxableOrdinaryIncomeAnnual = Number(document.getElementById('tax-income-annual')?.value || 0);
      const standardDeduction = Number(document.getElementById('tax-deduction')?.value || 0);
      const plannedRothConversion = Number(document.getElementById('tax-conversion')?.value || 0);
      const realizedMode = document.getElementById('tax-realized-mode')?.value || 'confirmed_or_estimate';
      await API.updateTaxPlanner({
        filingStatus,
        taxableOrdinaryIncomeAnnual,
        standardDeduction,
        plannedRothConversion,
        realizedMode,
      });
      await this.render(container);
      return;
    }

    if (action === 'save-carryover') {
      const input = document.getElementById('tax-carryover-input');
      const amount = Number(input?.value || 0);
      await API.updateTaxCarryover(this._data.taxYear, amount);
      await this.render(container);
      return;
    }

    if (action === 'confirm-sale') {
      const wrapper = event.target.closest('.tax-sale-actions');
      const saleId = wrapper?.dataset?.saleId;
      if (!saleId) return;
      const overrideInput = wrapper.querySelector('.tax-override-input');
      const notesInput = wrapper.querySelector('.tax-notes-input');
      const overrideValue = overrideInput && overrideInput.value.trim() !== ''
        ? Number(overrideInput.value)
        : null;
      await API.updateTaxSaleConfirmation(saleId, {
        confirmed: true,
        gainLossOverride: overrideValue,
        notes: notesInput ? notesInput.value : '',
      });
      await this.render(container);
    }
  },

  _saleActions(row) {
    return `
      <div class="tax-sale-actions" data-sale-id="${this._escapeAttr(row.id)}">
        <input class="tax-override-input" type="number" step="0.01" placeholder="Override $" value="${row.gainLossOverride != null ? this._escapeAttr(String(row.gainLossOverride)) : ''}">
        <input class="tax-notes-input" type="text" placeholder="Note" value="${this._escapeAttr(row.confirmation?.notes || '')}">
        <button class="tax-action-btn" data-action="confirm-sale">${row.confirmed ? 'Update' : 'Confirm FIFO'}</button>
      </div>
    `;
  },

  _statusPill(row) {
    if (row.needsData) return '<span class="tax-status-pill needs-data">Needs data</span>';
    if (row.confirmed) return '<span class="tax-status-pill confirmed">Confirmed</span>';
    if (row.needsConfirmation) return '<span class="tax-status-pill needs-data">Confirm</span>';
    return '<span class="tax-status-pill">Estimated</span>';
  },

  _termPill(term) {
    const label = this._formatTerm(term);
    const cls = term === 'long' ? 'confirmed' : term === 'short' ? 'needs-data' : '';
    return `<span class="tax-status-pill ${cls}">${this._escape(label)}</span>`;
  },

  _lotSummary(lots) {
    if (!lots || lots.length === 0) return '<span class="tax-lot-list">No FIFO lots matched</span>';
    return `
      <div class="tax-lot-list">
        ${lots.map(lot => `
          <div>${this._escape(lot.acquiredDate)} &middot; ${Fmt.num(lot.quantity, 0)} sh &middot; ${this._escape(this._formatTerm(lot.holdingTerm))}${lot.holdingTerm === 'short' ? ` &middot; long ${this._escape(lot.longTermDate)}` : ''}</div>
        `).join('')}
      </div>
    `;
  },

  _formatTerm(term) {
    if (term === 'long') return 'Long';
    if (term === 'short') return 'Short';
    if (term === 'mixed') return 'Mixed';
    return 'Unknown';
  },

  _gainClass(value) {
    const n = Number(value || 0);
    return n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral';
  },

  _gainTextClass(value) {
    const n = Number(value || 0);
    if (n > 0) return 'tax-gain';
    if (n < 0) return 'tax-loss';
    return '';
  },

  _money(value) {
    if (value === null || value === undefined || value === 'N/A') return 'N/A';
    const n = Number(value);
    if (Number.isNaN(n)) return 'N/A';
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  _escape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  _escapeAttr(value) {
    return this._escape(value).replace(/`/g, '&#96;');
  },
};

window.TaxesDashboard = TaxesDashboard;
