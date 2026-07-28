/**
 * privateNav.js - Shared family-only investing subnavigation.
 */
const PrivateNav = {
  items: [
    { key: 'overview', label: 'Overview', href: '#private' },
    { key: 'taxes', label: 'Taxes', href: '#taxes' },
    { key: 'tracker', label: 'Account Tracker', href: '#private-tracker' },
    { key: 'study', label: 'Success Study', href: '#private-study' },
  ],

  render(container, activeKey) {
    const nav = document.createElement('nav');
    nav.className = 'family-investing-tabs private-page-nav';
    nav.setAttribute('aria-label', 'Private investing');
    nav.innerHTML = this.items.map(item => `
      <a href="${item.href}" class="${item.key === activeKey ? 'active' : ''}" ${item.key === activeKey ? 'aria-current="page"' : ''}>
        ${item.label}
      </a>
    `).join('');
    container.appendChild(nav);
    return nav;
  },
};

window.PrivateNav = PrivateNav;
