/**
 * api.js — Fetch wrapper for backend API calls.
 */
const API = {
  _cache: {},

  async getPortfolio(forceRefresh = false) {
    if (!forceRefresh && this._cache.portfolio) return this._cache.portfolio;
    const res = await fetch('/api/portfolio');
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    this._cache.portfolio = data;
    return data;
  },

  async getStock(ticker) {
    const key = `stock_${ticker.toUpperCase()}`;
    if (this._cache[key]) return this._cache[key];
    const res = await fetch(`/api/stock/${ticker}`);
    if (!res.ok) throw new Error(`API error: ${res.status} for ${ticker}`);
    const data = await res.json();
    this._cache[key] = data;
    return data;
  },

  async getLivePortfolio(forceRefresh = false) {
    const key = 'live_portfolio';
    if (!forceRefresh && this._cache[key]) return this._cache[key];
    const res = await fetch('/api/live-portfolio');
    if (!res.ok) throw new Error(`Live portfolio fetch failed: ${res.status}`);
    const data = await res.json();
    this._cache[key] = data;
    return data;
  },

  async refresh() {
    this._cache = {};
    const res = await fetch('/api/refresh');
    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
    return res.json();
  },

  clearCache() {
    this._cache = {};
  },
};

window.API = API;
