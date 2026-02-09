/**
 * saulUtils.js — Shared Saul rules scoring logic.
 * Used by both normalizer.js (for dashboard_metrics evaluation data)
 * and markdownParser.js (for regex-extracted rules from markdown).
 */

function computeSaulSummary(rules) {
  if (!rules || Object.keys(rules).length === 0) return null;

  // Tier classification based on rule numbers
  const tiers = {
    tier1: {}, // R_001 - R_009 (critical checks)
    tier2: {}, // R_010 - R_017 (positive signals)
    tier3: {}, // R_018 - R_024 (warnings & context)
  };

  for (const [rule, status] of Object.entries(rules)) {
    const num = parseInt(rule.replace(/R_0*/, ''));
    if (num <= 9) tiers.tier1[rule] = status;
    else if (num <= 17) tiers.tier2[rule] = status;
    else tiers.tier3[rule] = status;
  }

  const countStatus = (tierObj, status) =>
    Object.values(tierObj).filter(s => s === status).length;

  const tier1Passes = countStatus(tiers.tier1, 'PASS');
  const tier1Fails = countStatus(tiers.tier1, 'FAIL');
  const tier1Total = Object.keys(tiers.tier1).length;
  const tier2Passes = countStatus(tiers.tier2, 'PASS');
  const tier2Fails = countStatus(tiers.tier2, 'FAIL');
  const tier3Warnings = countStatus(tiers.tier3, 'WARNING') + countStatus(tiers.tier3, 'CAUTION');

  // Scoring: tier1 passes × 3, tier2 passes × 2, tier3 passes × 1, fails subtract
  const score = (tier1Passes * 3) + (tier2Passes * 2) + countStatus(tiers.tier3, 'PASS')
    - (tier1Fails * 3) - (tier2Fails * 2);

  let overallGrade;
  if (tier1Fails > 0) overallGrade = 'FAIL';
  else if (tier1Passes === tier1Total && tier2Passes >= 5) overallGrade = 'STRONG';
  else if (tier1Passes === tier1Total && tier2Passes >= 3) overallGrade = 'PASS';
  else if (tier1Passes === tier1Total) overallGrade = 'WEAK_PASS';
  else overallGrade = 'INCOMPLETE';

  return {
    tiers,
    tier1Passes, tier1Fails, tier1Total,
    tier2Passes, tier2Fails,
    tier3Warnings,
    score,
    overallGrade,
  };
}

module.exports = { computeSaulSummary };
