/**
 * quality.js - Quality score dashboard.
 * Shows owned-company score drivers and a movable non-owned favorites list.
 */
const QualityDashboard = {
  _watchlistStorageKey: 'qualityWatchlistFavorites.v1',

  async render(container, companies) {
    container.innerHTML = '';

    const section = document.createElement('div');
    section.className = 'dashboard quality-dashboard';

    section.appendChild(this._metricRow(companies));
    section.appendChild(this._qualityOverview(companies));
    section.appendChild(this._ownedQualityTable(companies));

    try {
      const nonPortfolioData = await API.getNonPortfolioCompanies();
      section.appendChild(this._watchlistSection(nonPortfolioData.companies || []));
    } catch (err) {
      console.warn('[Quality] Non-portfolio watchlist skipped:', err.message);
    }

    container.appendChild(section);
  },

  _metricRow(companies) {
    const withScore = companies.filter(c => this._qualityScore(c) != null);
    const avgScore = withScore.length > 0
      ? withScore.reduce((sum, c) => sum + this._qualityScore(c), 0) / withScore.length
      : null;
    const top = [...withScore].sort((a, b) => this._qualityScore(b) - this._qualityScore(a))[0];
    const highQuality = withScore.filter(c => this._qualityScore(c) >= 80).length;

    const metricsRow = document.createElement('div');
    metricsRow.className = 'section';
    MetricCard.renderRow(metricsRow, [
      { label: 'Avg Quality', value: avgScore == null ? 'N/A' : Math.round(avgScore), subtext: 'Owned companies', colorClass: avgScore >= 80 ? 'positive' : avgScore >= 60 ? 'neutral' : 'negative' },
      { label: 'High Quality', value: `${highQuality}/${companies.length}`, subtext: 'Score 80+' },
      { label: 'Top Holding', value: top ? top.ticker : 'N/A', subtext: top ? `Score ${Math.round(this._qualityScore(top))}` : '' },
      { label: 'Scored Holdings', value: `${withScore.length}/${companies.length}`, subtext: 'Quality score present' },
    ]);
    return metricsRow;
  },

  _qualityOverview(companies) {
    const ownedQualitySection = document.createElement('div');
    ownedQualitySection.className = 'section';
    ownedQualitySection.innerHTML = `
      <h2 class="section-title">Owned Quality Score</h2>
      <p class="section-subtitle">Ranked by score, with the strongest quality components and key strengths surfaced for each holding.</p>
    `;

    const grid = document.createElement('div');
    grid.className = 'quality-overview-grid';

    [...companies]
      .sort((a, b) => (this._qualityScore(b) ?? -Infinity) - (this._qualityScore(a) ?? -Infinity))
      .forEach(company => grid.appendChild(this._qualityCard(company)));

    ownedQualitySection.appendChild(grid);
    return ownedQualitySection;
  },

  _ownedQualityTable(companies) {
    const ownedSection = document.createElement('div');
    ownedSection.className = 'section';
    ownedSection.innerHTML = '<h2 class="section-title">Owned Quality Ranking</h2>';

    SortableTable.render(ownedSection, {
      columns: [
        { key: 'ticker', label: 'Company', width: '90px' },
        { key: '_quality', label: 'Quality', format: v => Fmt.qualityScore(v), align: 'right', width: '90px' },
        { key: '_seasonal', label: 'Seasonal Quality', format: v => v == null ? 'N/A' : Fmt.qualityScore(v), align: 'right', width: '130px' },
        { key: 'revenueYoyPct', label: 'Rev YoY', format: v => Fmt.pct(v, true), align: 'right', width: '90px' },
        { key: 'ebitdaMarginPct', label: 'EBITDA Margin', format: v => Fmt.pct(v), align: 'right', width: '120px' },
        { key: '_gav', label: 'GAV', format: v => v != null ? v.toFixed(2) : 'N/A', align: 'right', width: '80px' },
      ],
      data: companies.map(c => ({
        ...c,
        _quality: this._qualityScore(c),
        _seasonal: this._seasonalQuality(c)?.score ?? null,
        _gav: c.calculated?.gav ?? null,
      })),
      defaultSort: '_quality',
      defaultDir: 'desc',
      onRowClick: (row) => {
        window.location.hash = `#deepdive?ticker=${row.ticker}`;
      },
    });
    return ownedSection;
  },

  _qualityCard(company) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'quality-card';
    card.addEventListener('click', () => {
      window.location.hash = `#deepdive?ticker=${company.ticker}`;
    });

    const score = this._qualityScore(company);
    const components = this._qualityComponents(company.qualityBreakdown);
    const strengths = this._qualityStrengths(company);
    const seasonal = this._seasonalQuality(company);

    card.innerHTML = `
      <div class="quality-card-header">
        <span class="quality-card-ticker">${this._escapeHtml(company.ticker)}</span>
        ${Fmt.qualityScore(score)}
      </div>
      <div class="quality-card-name">${this._escapeHtml(company.companyName || company.ticker)}</div>
      <div class="quality-component-list">
        ${components.map(item => `
          <div class="quality-component">
            <span>${this._escapeHtml(item.label)}</span>
            <strong>${this._escapeHtml(item.display)}</strong>
          </div>
        `).join('')}
      </div>
      ${this._seasonalQualityHtml(seasonal)}
      <ul class="quality-strength-list">
        ${strengths.map(item => `<li>${this._escapeHtml(item)}</li>`).join('')}
      </ul>
    `;
    return card;
  },

  _watchlistSection(nonPortfolioCompanies) {
    const section = document.createElement('div');
    section.className = 'section watchlist-section';
    section.innerHTML = `
      <h2 class="section-title">Other Companies & Favorites</h2>
      <p class="section-subtitle">Move non-owned companies into Favorites and reorder them for quick review.</p>
    `;

    const state = this._loadWatchlistState(nonPortfolioCompanies);
    const wrap = document.createElement('div');
    wrap.className = 'watchlist-board';
    section.appendChild(wrap);

    const render = () => {
      const byTicker = new Map(nonPortfolioCompanies.map(c => [c.ticker, c]));
      const favoriteTickers = state.favorites.filter(t => byTicker.has(t));
      const otherCompanies = nonPortfolioCompanies
        .filter(c => !favoriteTickers.includes(c.ticker))
        .sort((a, b) => (this._qualityScore(b) ?? -Infinity) - (this._qualityScore(a) ?? -Infinity) || a.ticker.localeCompare(b.ticker));

      wrap.innerHTML = '';
      wrap.appendChild(this._watchlistColumn('Favorites', favoriteTickers.map(t => byTicker.get(t)), true, state, render));
      wrap.appendChild(this._watchlistColumn('Available', otherCompanies, false, state, render));
    };

    render();
    return section;
  },

  _watchlistColumn(title, companies, isFavorite, state, rerender) {
    const column = document.createElement('div');
    column.className = 'watchlist-column';
    column.dataset.column = isFavorite ? 'favorites' : 'available';
    column.innerHTML = `
      <div class="watchlist-column-head">
        <h3>${this._escapeHtml(title)}</h3>
        <span>${companies.length}</span>
      </div>
    `;

    const list = document.createElement('div');
    list.className = 'watchlist-list';
    list.addEventListener('dragover', event => event.preventDefault());
    list.addEventListener('drop', event => {
      event.preventDefault();
      const ticker = event.dataTransfer.getData('text/plain');
      if (!ticker) return;
      if (isFavorite && !state.favorites.includes(ticker)) {
        state.favorites.push(ticker);
      } else if (!isFavorite) {
        state.favorites = state.favorites.filter(t => t !== ticker);
      }
      this._saveWatchlistState(state);
      rerender();
    });

    if (companies.length === 0) {
      list.innerHTML = `<div class="watchlist-empty">${isFavorite ? 'No favorites yet' : 'No available companies'}</div>`;
    } else {
      companies.forEach((company, index) => {
        list.appendChild(this._watchlistItem(company, index, isFavorite, state, rerender));
      });
    }

    column.appendChild(list);
    return column;
  },

  _watchlistItem(company, index, isFavorite, state, rerender) {
    const item = document.createElement('div');
    item.className = isFavorite ? 'watchlist-item watchlist-item-expanded' : 'watchlist-item';
    item.draggable = true;
    item.dataset.ticker = company.ticker;
    item.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', company.ticker);
      event.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragover', event => event.preventDefault());
    item.addEventListener('drop', event => {
      event.preventDefault();
      const dragged = event.dataTransfer.getData('text/plain');
      if (!dragged || dragged === company.ticker) return;
      state.favorites = state.favorites.filter(t => t !== dragged);
      if (isFavorite) {
        const targetIndex = state.favorites.indexOf(company.ticker);
        state.favorites.splice(Math.max(targetIndex, 0), 0, dragged);
      } else {
        state.favorites.push(dragged);
      }
      this._saveWatchlistState(state);
      rerender();
    });

    if (isFavorite) {
      const components = this._qualityComponents(company.qualityBreakdown);
      const seasonal = this._seasonalQuality(company);
      item.innerHTML = `
        <div class="watchlist-expanded-head">
          <div class="watchlist-main">
            <span class="watchlist-drag" title="Drag to move">::</span>
            <button type="button" class="watchlist-ticker">${this._escapeHtml(company.ticker)}</button>
            <span class="watchlist-name">${this._escapeHtml(company.companyName || '')}</span>
          </div>
          <div class="watchlist-actions">
            <button type="button" data-action="up" title="Move up">Up</button>
            <button type="button" data-action="down" title="Move down">Down</button>
            <button type="button" data-action="toggle">Remove</button>
          </div>
        </div>
        <div class="watchlist-expanded-score">
          ${Fmt.qualityScore(this._qualityScore(company))}
          <span>${Fmt.pct(company.revenueYoyPct, true)} Rev YoY</span>
        </div>
        <div class="quality-component-list">
          ${components.map(component => `
            <div class="quality-component">
              <span>${this._escapeHtml(component.label)}</span>
              <strong>${this._escapeHtml(component.display)}</strong>
            </div>
          `).join('')}
        </div>
        ${this._seasonalQualityHtml(seasonal)}
      `;
    } else {
      item.innerHTML = `
        <div class="watchlist-main">
          <span class="watchlist-drag" title="Drag to move">::</span>
          <button type="button" class="watchlist-ticker">${this._escapeHtml(company.ticker)}</button>
          <span class="watchlist-name">${this._escapeHtml(company.companyName || '')}</span>
        </div>
        <div class="watchlist-metrics">
          ${Fmt.qualityScore(this._qualityScore(company))}
          <span>${Fmt.pct(company.revenueYoyPct, true)}</span>
        </div>
        <div class="watchlist-actions">
          <button type="button" data-action="toggle">Favorite</button>
        </div>
      `;
    }

    item.querySelector('.watchlist-ticker').addEventListener('click', () => {
      window.location.hash = `#deepdive?ticker=${company.ticker}`;
    });
    item.querySelectorAll('.watchlist-actions button').forEach(button => {
      button.addEventListener('click', () => {
        const actionName = button.dataset.action;
        if (actionName === 'toggle') {
          state.favorites = isFavorite
            ? state.favorites.filter(t => t !== company.ticker)
            : [...state.favorites.filter(t => t !== company.ticker), company.ticker];
        } else if (actionName === 'up' && index > 0) {
          [state.favorites[index - 1], state.favorites[index]] = [state.favorites[index], state.favorites[index - 1]];
        } else if (actionName === 'down' && index < state.favorites.length - 1) {
          [state.favorites[index + 1], state.favorites[index]] = [state.favorites[index], state.favorites[index + 1]];
        }
        this._saveWatchlistState(state);
        rerender();
      });
    });

    return item;
  },

  _loadWatchlistState(companies) {
    const available = new Set(companies.map(c => c.ticker));
    try {
      const prior = JSON.parse(localStorage.getItem('summaryWatchlistFavorites.v1') || '{}');
      const parsed = JSON.parse(localStorage.getItem(this._watchlistStorageKey) || '{}');
      const favorites = Array.isArray(parsed.favorites)
        ? parsed.favorites
        : Array.isArray(prior.favorites)
          ? prior.favorites
          : [];
      return { favorites: favorites.filter(t => available.has(t)) };
    } catch (err) {
      return { favorites: [] };
    }
  },

  _saveWatchlistState(state) {
    localStorage.setItem(this._watchlistStorageKey, JSON.stringify({
      favorites: state.favorites,
    }));
  },

  _qualityComponents(breakdown) {
    const ordered = [
      ['valuation', 'Valuation', 15],
      ['growth', 'Growth', 25],
      ['margins_op_leverage', 'Margins/Leverage', 20],
      ['profitability', 'Profitability', 15],
      ['share_count', 'Share Discipline', 10],
      ['rule_alignment', 'Rule Alignment', 15],
    ];

    if (!breakdown || typeof breakdown !== 'object') {
      return ordered.map(([, label]) => ({ label, value: null, display: 'N/A' }));
    }

    return ordered.map(([key, label, max]) => {
      const value = breakdown[key];
      return {
        label,
        value,
        display: value === null || value === undefined ? `N/A / ${max}` : `${value} / ${max}`,
      };
    });
  },

  _topQualityComponents(breakdown) {
    return this._qualityComponents(breakdown)
      .filter(component => component.value !== null && component.value !== undefined)
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 3);
  },

  _seasonalQuality(company) {
    const score = this._qualityScore(company);
    const currentGrowthScore = company.qualityBreakdown?.growth;
    const yoyPct = this._latestYoy(company);
    if (!this._isFiniteNumber(score) || !this._isFiniteNumber(currentGrowthScore) || !this._isFiniteNumber(yoyPct)) {
      return null;
    }

    const seasonalGrowthScore = this._smoothGrowthScore(yoyPct);
    if (!this._isFiniteNumber(seasonalGrowthScore)) return null;

    const seasonalScore = score - currentGrowthScore + seasonalGrowthScore;
    return {
      score: Math.round(seasonalScore),
      delta: seasonalScore - score,
      currentGrowthScore,
      seasonalGrowthScore: Math.round(seasonalGrowthScore * 10) / 10,
      yoyPct,
    };
  },

  _seasonalQualityHtml(seasonal) {
    if (!seasonal) {
      return `
        <div class="quality-seasonal">
          <span>Seasonal Quality</span>
          <strong>N/A</strong>
          <small>Needs YoY growth and growth score</small>
        </div>
      `;
    }

    const delta = Math.round(seasonal.delta * 10) / 10;
    const sign = delta > 0 ? '+' : '';
    return `
      <div class="quality-seasonal">
        <span>Seasonal Quality</span>
        <strong>${seasonal.score} <em>${sign}${delta.toFixed(1)}</em></strong>
        <small>Uses YoY growth ${Fmt.pct(seasonal.yoyPct, true)} instead of QoQ momentum for growth score ${seasonal.seasonalGrowthScore}</small>
      </div>
    `;
  },

  _latestYoy(company) {
    const hist = company.quarterlyHistory || [];
    const current = hist[0];
    const yearAgo = hist[4];
    if (this._isFiniteNumber(current?.revenueYoyPct)) return current.revenueYoyPct;
    if (this._isFiniteNumber(company.revenueYoyPct)) return company.revenueYoyPct;
    if (this._isFiniteNumber(current?.revenueMil) && this._isFiniteNumber(yearAgo?.revenueMil) && yearAgo.revenueMil !== 0) {
      return ((current.revenueMil / yearAgo.revenueMil) - 1) * 100;
    }
    return null;
  },

  _smoothGrowthScore(growthPct) {
    if (!this._isFiniteNumber(growthPct)) return null;
    const interpolate = (value, start, end, startScore, endScore) => {
      const ratio = (value - start) / (end - start);
      return startScore + ratio * (endScore - startScore);
    };
    if (growthPct < 35) return 0;
    if (growthPct < 45) return interpolate(growthPct, 35, 45, 10, 13);
    if (growthPct < 55) return interpolate(growthPct, 45, 55, 13, 16);
    if (growthPct < 60) return interpolate(growthPct, 55, 60, 16, 19);
    if (growthPct < 75) return interpolate(growthPct, 60, 75, 19, 22);
    if (growthPct < 100) return interpolate(growthPct, 75, 100, 22, 25);
    return 25;
  },

  _isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  },

  _qualityStrengths(company) {
    const strengths = Array.isArray(company.keyStrengths) ? company.keyStrengths : [];
    if (strengths.length > 0) return strengths.slice(0, 2);

    const fallback = [];
    if (company.revenueYoyPct != null) fallback.push(`Revenue growth ${Fmt.pct(company.revenueYoyPct, true)}`);
    if (company.ebitdaMarginPct != null) fallback.push(`EBITDA margin ${Fmt.pct(company.ebitdaMarginPct)}`);
    if (company.calculated?.gav != null) fallback.push(`GAV ${company.calculated.gav.toFixed(2)}`);
    return fallback.slice(0, 2);
  },

  _qualityScore(company) {
    return company.qualityScore ?? company.quality_score ?? null;
  },

  _escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  destroy() {},
};

window.QualityDashboard = QualityDashboard;
