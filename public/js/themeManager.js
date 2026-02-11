/**
 * themeManager.js — Theme switching with localStorage persistence.
 */
const ThemeManager = {
  current: 'bloomberg',
  themes: ['bloomberg', 'minimalist', 'terminal', 'colorful', 'newspaper'],

  init() {
    const saved = localStorage.getItem('portfolio-theme');
    if (saved && this.themes.includes(saved)) {
      this._initializing = true;
      this.apply(saved);
      this._initializing = false;
    }

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

    // Swap stylesheet
    const link = document.getElementById('theme-stylesheet');
    if (link) link.href = `/css/themes/${themeName}.css`;

    // Update selector if it exists
    const selector = document.getElementById('theme-selector');
    if (selector) selector.value = themeName;

    // Re-apply Chart.js theme colors
    if (window.ChartDefaults) {
      // Small delay to let CSS variables load
      requestAnimationFrame(() => {
        ChartDefaults.applyTheme(themeName);
        // Re-render active dashboard to pick up new colors
        if (window.App && window.App.currentDashboard && !this._initializing) {
          window.App.renderDashboard(window.App.currentDashboard);
        }
      });
    }
  },
};

window.ThemeManager = ThemeManager;
