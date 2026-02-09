/**
 * deepDive.js — Dashboard 4: Individual Stock Deep Dive
 * Stock selector, metrics cards, multi-metric chart, P/E compression, Saul grid, markdown analysis.
 */
const DeepDiveDashboard = {
  _currentTicker: null,

  async render(container, companies) {
    container.innerHTML = '';
    this.destroy();

    const section = document.createElement('div');
    section.className = 'dashboard deepdive-dashboard';

    // ── Stock Selector ──
    const selectorBar = document.createElement('div');
    selectorBar.className = 'selector-bar';
    selectorBar.innerHTML = `
      <label class="stock-selector-label">
        <span>Select Stock:</span>
        <select id="deepdive-ticker-select">
          ${companies.map(c =>
            `<option value="${c.ticker}">${c.ticker} — ${c.companyName || c.ticker}</option>`
          ).join('')}
        </select>
      </label>
    `;
    section.appendChild(selectorBar);

    // Content area
    const content = document.createElement('div');
    content.id = 'deepdive-content';
    section.appendChild(content);

    container.appendChild(section);

    // Determine initial ticker
    const hash = window.location.hash;
    const tickerMatch = hash.match(/ticker=(\w+)/);
    const initialTicker = tickerMatch ? tickerMatch[1].toUpperCase() : companies[0]?.ticker;

    const select = document.getElementById('deepdive-ticker-select');
    if (select) {
      select.value = initialTicker;
      select.addEventListener('change', () => {
        this._renderStock(content, select.value, companies);
      });
    }

    this._renderStock(content, initialTicker, companies);
  },

  async _renderStock(container, ticker, companies) {
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div></div>';
    this._currentTicker = ticker;
    this.destroy();

    // Fetch full stock data including markdown
    let stockData;
    try {
      stockData = await API.getStock(ticker);
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Error loading ${ticker}: ${err.message}</div>`;
      return;
    }

    const company = stockData.company;
    const analysis = stockData.analysis;
    if (!company) {
      container.innerHTML = `<div class="empty-state">No data for ${ticker}</div>`;
      return;
    }

    container.innerHTML = '';

    // ── Key Metrics Cards ──
    const metricsSection = document.createElement('div');
    metricsSection.className = 'section';
    const distHigh = company.calculated?.distanceFromHigh;
    MetricCard.renderRow(metricsSection, [
      { label: 'Price', value: Fmt.price(company.price) },
      { label: 'Market Cap', value: Fmt.millions(company.marketCapMil) },
      { label: 'Revenue YoY', value: Fmt.pct(company.revenueYoyPct, true), colorClass: (company.revenueYoyPct || 0) >= 35 ? 'positive' : 'neutral' },
      { label: 'Revenue QoQ', value: Fmt.pct(company.revenueQoqPct, true) },
    ]);
    MetricCard.renderRow(metricsSection, [
      { label: 'Gross Margin', value: Fmt.pct(company.grossMarginPct) },
      { label: 'EBITDA Margin', value: Fmt.pct(company.ebitdaMarginPct) },
      { label: 'P/S Ratio', value: Fmt.multiple(company.priceToSales) },
      { label: 'From 52w High', value: distHigh !== null ? Fmt.pct(distHigh, true) : 'N/A', colorClass: distHigh < -20 ? 'negative' : '' },
    ]);
    container.appendChild(metricsSection);

    // ── Verdict & Momentum Row ──
    const verdictSection = document.createElement('div');
    verdictSection.className = 'section verdict-row';
    const momentum = company.calculated?.momentum;
    verdictSection.innerHTML = `
      <div class="verdict-card">
        <span class="label">Verdict:</span> ${Fmt.verdict(company.verdict)}
      </div>
      <div class="verdict-card">
        <span class="label">Momentum:</span> ${momentum ? Fmt.momentum(momentum.trend) : 'N/A'}
      </div>
      <div class="verdict-card">
        <span class="label">Op Leverage:</span> ${Fmt.multiple(company.calculated?.operatingLeverage)}
      </div>
      <div class="verdict-card">
        <span class="label">GAV:</span> ${company.calculated?.gav?.toFixed(1) || 'N/A'}
      </div>
    `;
    container.appendChild(verdictSection);

    // ── Revenue History Chart ──
    if (company.quarterlyHistory && company.quarterlyHistory.length > 0) {
      const chartSection = document.createElement('div');
      chartSection.className = 'section';
      chartSection.innerHTML = `
        <h2 class="section-title">Revenue & Growth History</h2>
        <div class="chart-row">
          <div class="chart-container"><canvas id="dd-revenue-chart"></canvas></div>
          <div class="chart-container"><canvas id="dd-growth-chart"></canvas></div>
        </div>
      `;
      container.appendChild(chartSection);

      const hist = [...company.quarterlyHistory].reverse();
      const labels = hist.map(q => q.quarter);

      setTimeout(() => {
        // Revenue bars
        BarChart.render('dd-revenue-chart', {
          labels,
          datasets: [{
            label: 'Revenue ($M)',
            data: hist.map(q => q.revenueMil),
            color: Colors.chartPalette[0],
          }],
          yLabel: 'Revenue ($M)',
        });

        // Growth lines
        LineChart.render('dd-growth-chart', {
          labels,
          datasets: [
            {
              label: 'YoY %',
              data: hist.map(q => q.revenueYoyPct),
              color: Colors.chartPalette[1],
            },
            {
              label: 'QoQ %',
              data: hist.map(q => q.revenueQoqPct),
              color: Colors.chartPalette[2],
              dashed: true,
            },
          ],
          yLabel: 'Growth %',
        });
      }, 50);
    }

    // ── P/E Compression ──
    const peSection = document.createElement('div');
    peSection.className = 'section';
    peSection.innerHTML = '<h2 class="section-title">P/E Compression Analysis</h2>';
    const peData = company.calculated?.peCompression || company.peCompression;
    PeCompression.render(peSection, peData);
    container.appendChild(peSection);

    // ── Unit Economics (if available) ──
    if (company.unitEconomics) {
      const unitSection = document.createElement('div');
      unitSection.className = 'section';
      unitSection.innerHTML = '<h2 class="section-title">Unit Economics</h2>';
      MetricCard.renderRow(unitSection, [
        { label: 'CAC', value: Fmt.price(company.unitEconomics.cac) },
        { label: 'ARPU', value: Fmt.price(company.unitEconomics.arpu) },
        { label: 'ARPU/CAC Ratio', value: company.unitEconomics.arpuToCacRatio?.toFixed(1) + 'x' || 'N/A', colorClass: (company.unitEconomics.arpuToCacRatio || 0) > 3 ? 'positive' : '' },
      ]);
      container.appendChild(unitSection);
    }

    // ── Saul Rules Grid ──
    if (company.saulRules && Object.keys(company.saulRules).length > 0) {
      const saulSection = document.createElement('div');
      saulSection.className = 'section';
      saulSection.innerHTML = '<h2 class="section-title">Saul\'s Rules Evaluation</h2>';
      SaulGrid.render(saulSection, company.saulRules, company.saulSummary);
      container.appendChild(saulSection);
    }

    // ── Bull / Bear Case ──
    if ((company.bullCase && company.bullCase.length) || (company.bearCase && company.bearCase.length)) {
      const thesisSection = document.createElement('div');
      thesisSection.className = 'section';
      thesisSection.innerHTML = '<h2 class="section-title">Investment Thesis</h2>';

      const thesisGrid = document.createElement('div');
      thesisGrid.className = 'thesis-grid';

      if (company.bullCase && company.bullCase.length) {
        thesisGrid.innerHTML += `
          <div class="thesis-card bull-card">
            <h3>Bull Case</h3>
            <ul>${company.bullCase.map(b => `<li>${b}</li>`).join('')}</ul>
          </div>
        `;
      }
      if (company.bearCase && company.bearCase.length) {
        thesisGrid.innerHTML += `
          <div class="thesis-card bear-card">
            <h3>Bear Case</h3>
            <ul>${company.bearCase.map(b => `<li>${b}</li>`).join('')}</ul>
          </div>
        `;
      }

      thesisSection.appendChild(thesisGrid);
      container.appendChild(thesisSection);
    }

    // ── Company Description ──
    if (company.businessDescription) {
      const descSection = document.createElement('div');
      descSection.className = 'section';
      descSection.innerHTML = `
        <h2 class="section-title">Business Overview</h2>
        <p class="business-desc">${company.businessDescription}</p>
      `;
      container.appendChild(descSection);
    }

    // ── Risk Factors ──
    if (company.riskFactors && company.riskFactors.length > 0) {
      const riskSection = document.createElement('div');
      riskSection.className = 'section';
      riskSection.innerHTML = `
        <h2 class="section-title">Risk Factors</h2>
        <div class="risk-list">
          ${company.riskFactors.map(r => `
            <div class="risk-item risk-${(r.severity || 'medium').toLowerCase()}">
              <span class="risk-category">${r.category}</span>
              <span class="risk-desc">${r.description}</span>
            </div>
          `).join('')}
        </div>
      `;
      container.appendChild(riskSection);
    }

    // ── Full Markdown Analysis (collapsible) ──
    if (stockData.rawMarkdown) {
      const mdSection = document.createElement('div');
      mdSection.className = 'section';
      mdSection.innerHTML = `
        <details class="md-details">
          <summary class="section-title clickable">Full Analysis (click to expand)</summary>
          <div class="md-content">${this._simpleMarkdown(stockData.rawMarkdown)}</div>
        </details>
      `;
      container.appendChild(mdSection);
    }
  },

  /** Basic markdown-to-HTML (no external library needed) */
  _simpleMarkdown(md) {
    return md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>').replace(/$/, '</p>')
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
      });
  },

  destroy() {
    BarChart.destroyAll();
    LineChart.destroyAll();
  },
};

window.DeepDiveDashboard = DeepDiveDashboard;
