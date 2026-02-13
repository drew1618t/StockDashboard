/**
 * saulGrid.js — Visual grid showing Saul's rules compliance with color coding.
 */
const SaulGrid = {
  /**
   * @param {HTMLElement} container
   * @param {Object} saulRules - { R_001: 'PASS', R_002: 'FAIL', ... }
   * @param {Object} [summary] - Computed summary from saulSummary
   */
  render(container, saulRules, summary) {
    if (!saulRules || Object.keys(saulRules).length === 0) {
      container.innerHTML = '<div class="empty-state">Saul evaluation not available</div>';
      return;
    }

    const ruleLabels = {
      R_001: 'Growth Guidance + QoQ',
      R_001A: 'Organic Growth',
      R_002: 'Management Credibility',
      R_003: 'Revenue Growth \u226535%',
      R_004: 'Not Defensive',
      R_005: 'Not Capital Intensive',
      R_006: 'Not Chinese/EM',
      R_007: 'Market Runway',
      R_008: '3-4x Upside',
      R_009: 'Path to Profitability',
      R_010: 'Net Retention >120%',
      R_011: 'Revenue Durability',
      R_012: 'Recurring Revenue',
      R_013: 'Gross Margins \u226575%',
      R_014: 'Land & Expand',
      R_015: 'High Switching Costs',
      R_016: 'Universal Need',
      R_017: 'Insider Buying',
      R_018: 'Management Quality',
      R_019: 'Customer Concentration',
      R_020: 'Track Record',
      R_021: 'Valuation',
      R_022: 'Float / Liquidity',
      R_023: 'SBC / Dilution',
      R_024: 'Sentiment',
    };

    const statusIcons = {
      PASS: { icon: '\u2713', cls: 'saul-pass' },
      FAIL: { icon: '\u2717', cls: 'saul-fail' },
      DISQUALIFIED: { icon: '\u2717', cls: 'saul-fail' },
      DISQ: { icon: '\u2717', cls: 'saul-fail' },
      WARNING: { icon: '\u26A0', cls: 'saul-warning' },
      CAUTION: { icon: '\u26A0', cls: 'saul-warning' },
      'N/A': { icon: '\u2014', cls: 'saul-na' },
      UNCLEAR: { icon: '?', cls: 'saul-na' },
      INSUFFICIENT_DATA: { icon: '?', cls: 'saul-na' },
    };

    const tiers = [
      { label: 'Tier 1: Hard Disqualifiers', rules: ['R_001', 'R_001A', 'R_003', 'R_006'] },
      { label: 'Tier 2: Weighted Factors', rules: ['R_002', 'R_004', 'R_005', 'R_007', 'R_008', 'R_009'] },
      { label: 'Tier 3: Strength Signals', rules: ['R_010', 'R_011', 'R_012', 'R_013', 'R_014', 'R_015', 'R_016', 'R_017'] },
      { label: 'Tier 4: Warnings & Context', rules: ['R_018', 'R_019', 'R_020', 'R_021', 'R_022', 'R_023', 'R_024'] },
    ];

    const wrapper = document.createElement('div');
    wrapper.className = 'saul-grid-wrapper';

    let html = '';

    // Summary bar
    if (summary) {
      const scoreCls = summary.score >= 70 ? 'score-high' :
                       summary.score >= 40 ? 'score-mid' : 'score-low';
      const convCls = summary.conviction === 'High' ? 'conviction-high' :
                      summary.conviction === 'Medium' ? 'conviction-mid' : 'conviction-low';
      html += `
        <div class="saul-summary">
          <span class="saul-score ${scoreCls}">Score: ${summary.score}/100</span>
          <span class="saul-conviction ${convCls}">Conviction: ${summary.conviction}</span>
          <span class="saul-detail">Base: ${summary.baseScore} + Bonus: ${summary.tier2Bonus} \u2212 Penalty: ${summary.warningPenalty}</span>
        </div>
      `;
    }

    tiers.forEach(tier => {
      const available = tier.rules.filter(r => saulRules[r] !== undefined);
      if (available.length === 0) return;

      html += `<div class="saul-tier"><div class="saul-tier-label">${tier.label}</div><div class="saul-rules">`;
      available.forEach(ruleKey => {
        const status = saulRules[ruleKey] || 'N/A';
        const info = statusIcons[status] || statusIcons['N/A'];
        const label = ruleLabels[ruleKey] || ruleKey;
        html += `
          <div class="saul-rule ${info.cls}" title="${label}: ${status}">
            <span class="saul-rule-icon">${info.icon}</span>
            <span class="saul-rule-id">${ruleKey.replace('R_0', 'R')}</span>
            <span class="saul-rule-label">${label}</span>
            <span class="saul-rule-status">${status}</span>
          </div>
        `;
      });
      html += '</div></div>';
    });

    wrapper.innerHTML = html;
    container.appendChild(wrapper);
  },
};

window.SaulGrid = SaulGrid;
