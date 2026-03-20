/**
 * app.js — Main application entry point.
 * Hash-based routing, dashboard lifecycle, chart cleanup.
 * Manages company selection state (deselection + comparisons).
 */
const App = {
  currentDashboard: null,
  companies: [],
  comparisonCompanies: [],
  deselectedTickers: new Set(),
  availableTickers: { portfolio: [], available: [] },
  user: null,
  dashboards: {
    summary: SummaryDashboard,
    growth: GrowthDashboard,
    valuation: ValuationDashboard,
    profitability: ProfitabilityDashboard,
    deepdive: DeepDiveDashboard,
  },

  /** Dashboards that show the company selector bar */
  _selectorDashboards: ['growth', 'valuation', 'profitability'],

  /** Returns active companies: portfolio (minus deselected) + comparisons */
  getActiveCompanies() {
    const portfolio = this.companies.filter(c => !this.deselectedTickers.has(c.ticker));
    return [...portfolio, ...this.comparisonCompanies];
  },

  async init() {
    try {
      this.user = await API.getMe();
      this._applyUserContext();

      const data = await API.getPortfolio();
      this.companies = (data.companies || []).map(c => ({ ...c, _isComparison: false }));
      document.getElementById('header-count').textContent =
        `${this.companies.length} holdings`;
    } catch (err) {
      this._renderInitError(err);
      return;
    }

    // Load available tickers for comparison input
    try {
      this.availableTickers = await API.getAvailableTickers();
    } catch (err) {
      console.warn('Could not load available tickers:', err);
    }

    // Initialize theme
    ThemeManager.init();
    ChartDefaults.applyTheme(ThemeManager.current);

    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', async () => {
      try {
        await API.refresh();
        const data = await API.getPortfolio(true);
        this.companies = (data.companies || []).map(c => ({ ...c, _isComparison: false }));
        this.availableTickers = await API.getAvailableTickers();
        this.renderDashboard(this.currentDashboard);
      } catch (err) {
        console.error('Refresh failed:', err);
      }
    });

    // Hash routing
    window.addEventListener('hashchange', () => this._handleRoute());
    this._handleRoute();
  },

  _handleRoute() {
    const hash = window.location.hash.replace('#', '').split('?')[0] || 'summary';
    this.renderDashboard(hash);

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.dashboard === hash);
    });
  },

  async renderDashboard(name) {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    // Destroy previous dashboard charts
    if (this.currentDashboard && this.dashboards[this.currentDashboard]) {
      this.dashboards[this.currentDashboard].destroy?.();
    }

    this.currentDashboard = name;
    const dashboard = this.dashboards[name];

    if (!dashboard) {
      container.innerHTML = `<div class="error-state">Unknown dashboard: ${name}</div>`;
      return;
    }

    // Show loading
    container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading...</p></div>';

    try {
      container.innerHTML = '';

      // Render company selector for comparison-enabled dashboards
      const showSelector = this._selectorDashboards.includes(name);
      if (showSelector) {
        CompanySelector.render(container, {
          portfolioTickers: this.companies.map(c => c.ticker),
          deselectedTickers: this.deselectedTickers,
          comparisonCompanies: this.comparisonCompanies,
          availableTickers: this.availableTickers.available || [],
          onToggle: (ticker, checked) => this._togglePortfolio(ticker, checked),
          onAddComparison: (ticker) => this._addComparison(ticker),
          onRemoveComparison: (ticker) => this._removeComparison(ticker),
        });
      }

      // Create sub-container for dashboard content so dashboards
      // can clear their area without removing the selector bar
      const dashContainer = document.createElement('div');
      container.appendChild(dashContainer);

      const companies = showSelector ? this.getActiveCompanies() : this.companies;
      await dashboard.render(dashContainer, companies);
    } catch (err) {
      console.error(`Error rendering ${name}:`, err);
      container.innerHTML = `<div class="error-state">Error: ${this._formatError(err)}</div>`;
    }
  },

  _applyUserContext() {
    const userEl = document.getElementById('header-user');
    const familyLink = document.getElementById('family-nav-link');
    if (userEl && this.user) {
      userEl.hidden = false;
      userEl.textContent = `${this.user.role.toUpperCase()} • ${this.user.email}`;
    }
    if (familyLink) {
      familyLink.hidden = !this.user || this.user.role !== 'family';
    }
  },

  _formatError(err) {
    if (!err) return 'Unknown error';
    if (err.status === 401) {
      return 'Authentication failed. Refresh the page and sign in through Cloudflare Access again.';
    }
    if (err.status === 403) {
      return 'Your account is authenticated, but this page is not available for your role.';
    }
    return err.message || 'Unknown error';
  },

  _renderInitError(err) {
    const message = this._formatError(err);
    document.getElementById('dashboard-content').innerHTML =
      `<div class="error-state">${message} <a href="/">Return home</a></div>`;
  },

  _togglePortfolio(ticker, checked) {
    if (checked) {
      this.deselectedTickers.delete(ticker);
    } else {
      this.deselectedTickers.add(ticker);
    }
    this.renderDashboard(this.currentDashboard);
  },

  async _addComparison(ticker) {
    try {
      const data = await API.getStock(ticker);
      if (!data.company) {
        console.warn(`No data returned for ${ticker}`);
        return;
      }
      this.comparisonCompanies.push({ ...data.company, _isComparison: true });
      this.renderDashboard(this.currentDashboard);
    } catch (err) {
      console.error(`Failed to load comparison ${ticker}:`, err);
    }
  },

  _removeComparison(ticker) {
    this.comparisonCompanies = this.comparisonCompanies.filter(c => c.ticker !== ticker);
    this.renderDashboard(this.currentDashboard);
  },
};

window.App = App;

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
