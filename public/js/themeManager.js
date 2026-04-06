/**
 * themeManager.js — Theme switching with localStorage persistence.
 */
const ThemeManager = {
  current: 'onyx',
  themes: ['onyx', 'ivory-ink'],

  init() {
    const saved = localStorage.getItem('portfolio-theme');
    const theme = (saved && this.themes.includes(saved)) ? saved : this.themes[0];

    // Always apply — clears stale localStorage and ensures CSS + body class are set
    this._initializing = true;
    this.apply(theme);
    this._initializing = false;

    const selector = document.getElementById('theme-selector');
    if (selector) {
      selector.value = this.current;
      selector.addEventListener('change', (e) => this.apply(e.target.value));
    }
  },

  apply(themeName) {
    if (!this.themes.includes(themeName)) return;

    this.current = themeName;
    localStorage.setItem('portfolio-theme', themeName);

    // Update body class
    document.body.className = `theme-${themeName}`;

    // Update selector if it exists
    const selector = document.getElementById('theme-selector');
    if (selector) selector.value = themeName;

    // Swap stylesheet and wait for it to load before re-rendering charts
    const link = document.getElementById('theme-stylesheet');
    const onReady = () => {
      if (window.ChartDefaults) {
        ChartDefaults.applyTheme(themeName);
        if (window.App && window.App.currentDashboard && !this._initializing) {
          window.App.renderDashboard(window.App.currentDashboard);
        }
      }
    };

    if (link) {
      const newHref = `/css/themes/${themeName}.css?v=2`;
      if (link.href.includes(`/css/themes/${themeName}.css`)) {
        // Already loaded — apply immediately
        requestAnimationFrame(onReady);
      } else {
        link.onload = () => requestAnimationFrame(onReady);
        link.href = newHref;
      }
    } else {
      requestAnimationFrame(onReady);
    }
  },
};

window.ThemeManager = ThemeManager;
