/**
 * familyInvesting.js - Family-only investing library inside Portfolio Viz.
 * Keeps household financial tools out of the primary analysis navigation.
 */
const FamilyInvestingDashboard = {
  async render(container) {
    container.innerHTML = '';

    const section = document.createElement('div');
    section.className = 'dashboard family-investing-dashboard';
    section.innerHTML = `
      <div class="section family-investing-header">
        <div>
          <div class="family-investing-kicker">Family-only</div>
          <h2 class="section-title">Family Investing</h2>
          <p class="family-investing-intro">
            Household records and planning tools live together here, while the main dashboard stays focused on company analysis.
          </p>
        </div>
        <a class="family-investing-hub-link" href="/family">Open Family Hub &rarr;</a>
      </div>

      <div class="family-investing-grid">
        <article class="family-investing-card family-investing-card--featured">
          <div class="family-investing-card-label">Planning tool</div>
          <h3>Taxes</h3>
          <p>FIFO estimates, realized and unrealized gains, term breakdowns, and Roth conversion planning.</p>
          <a class="family-investing-action" href="#taxes">Open tax dashboard</a>
        </article>

        <article class="family-investing-card">
          <div class="family-investing-card-label">Living record</div>
          <h3>Four-Account Portfolio Tracker</h3>
          <p>Balances, account allocation, consolidated holdings, transaction history, and reconciliation checks.</p>
          <a class="family-investing-action" href="#private-tracker">View account tracker</a>
        </article>

        <article class="family-investing-card">
          <div class="family-investing-card-label">Research archive</div>
          <h3>Investment Success Study</h3>
          <p>The complete account-level first-buy-to-peak analysis, exclusions, and methodology.</p>
          <div class="family-investing-card-actions">
            <a class="family-investing-action" href="#private-study">View success study</a>
            <a class="family-investing-text-link" href="/writing/investment-winners-what-the-data-says">Read public lesson</a>
          </div>
        </article>
      </div>

      <div class="family-investing-privacy">
        <strong>Family access only.</strong>
        Account identifiers and detailed household financial information stay behind the family authorization boundary.
      </div>
    `;

    PrivateNav.render(section, 'overview');
    section.insertBefore(section.lastElementChild, section.children[1]);
    container.appendChild(section);
  },

  destroy() {},
};
