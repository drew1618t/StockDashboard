/**
 * app.js — Main application entry point.
 * Hash-based routing, dashboard lifecycle, chart cleanup.
 */
const App = {
  currentDashboard: null,
  companies: [],
  dashboards: {
    summary: SummaryDashboard,
    growth: GrowthDashboard,
    valuation: ValuationDashboard,
    profitability: ProfitabilityDashboard,
    deepdive: DeepDiveDashboard,
  },

  async init() {
    // Load data
    try {
      const data = await API.getPortfolio();
      this.companies = data.companies || [];
      document.getElementById('header-count').textContent =
        `${this.companies.length} holdings`;
    } catch (err) {
      document.getElementById('dashboard-content').innerHTML =
        `<div class="error-state">Failed to load data: ${err.message}</div>`;
      return;
    }

    // Initialize theme
    ThemeManager.init();
    ChartDefaults.applyTheme(ThemeManager.current);

    // Refresh button
    document.getElementById('refresh-btn')?.addEventListener('click', async () => {
      try {
        await API.refresh();
        const data = await API.getPortfolio(true);
        this.companies = data.companies || [];
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
      await dashboard.render(container, this.companies);
    } catch (err) {
      console.error(`Error rendering ${name}:`, err);
      container.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
    }
  },
};

window.App = App;

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
