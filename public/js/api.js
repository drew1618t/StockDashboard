/**
 * api.js — Fetch wrapper for backend API calls.
 */
const API = {
  _cache: {},

  async _requestJson(url, options = {}) {
    const res = await fetch(url, options);
    let payload = null;

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await res.json();
    } else {
      const text = await res.text();
      payload = text ? { error: text } : null;
    }

    if (!res.ok) {
      const message = payload && payload.error ? payload.error : `API error: ${res.status}`;
      const err = new Error(message);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  },

  async getMe(forceRefresh = false) {
    if (!forceRefresh && this._cache.me) return this._cache.me;
    const data = await this._requestJson('/api/me');
    this._cache.me = data;
    return data;
  },

  async getPortfolio(forceRefresh = false) {
    if (!forceRefresh && this._cache.portfolio) return this._cache.portfolio;
    const data = await this._requestJson('/api/portfolio');
    this._cache.portfolio = data;
    return data;
  },

  async getStock(ticker) {
    const key = `stock_${ticker.toUpperCase()}`;
    if (this._cache[key]) return this._cache[key];
    const data = await this._requestJson(`/api/stock/${ticker}`);
    this._cache[key] = data;
    return data;
  },

  async getLivePortfolio(forceRefresh = false) {
    const key = 'live_portfolio';
    if (!forceRefresh && this._cache[key]) return this._cache[key];
    const data = await this._requestJson('/api/live-portfolio');
    this._cache[key] = data;
    return data;
  },

  async refreshLivePortfolio() {
    this._cache.live_portfolio = null;
    return this._requestJson('/api/live-portfolio/refresh');
  },

  async getTaxes(forceRefresh = false) {
    const key = 'taxes';
    if (!forceRefresh && this._cache[key]) return this._cache[key];
    const data = await this._requestJson('/api/family/taxes');
    this._cache[key] = data;
    return data;
  },

  async updateTaxCarryover(taxYear, amount) {
    this._cache.taxes = null;
    return this._requestJson('/api/family/taxes/carryover', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taxYear, amount }),
    });
  },

  async updateTaxSaleConfirmation(saleId, updates) {
    this._cache.taxes = null;
    return this._requestJson(`/api/family/taxes/sales/${encodeURIComponent(saleId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates || {}),
    });
  },

  async updateTaxPlanner(updates) {
    this._cache.taxes = null;
    return this._requestJson('/api/family/taxes/planner', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates || {}),
    });
  },

  async getAvailableTickers() {
    if (this._cache.availableTickers) return this._cache.availableTickers;
    const data = await this._requestJson('/api/available-tickers');
    this._cache.availableTickers = data;
    return data;
  },

  async getNonPortfolioCompanies(forceRefresh = false) {
    const key = 'nonPortfolioCompanies';
    if (!forceRefresh && this._cache[key]) return this._cache[key];
    const data = await this._requestJson('/api/non-portfolio-companies');
    this._cache[key] = data;
    return data;
  },

  async requestComparison(ticker) {
    return this._requestJson('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    });
  },

  async refresh() {
    this._cache = {};
    return this._requestJson('/api/refresh');
  },

  clearCache() {
    this._cache = {};
  },
};

window.API = API;
