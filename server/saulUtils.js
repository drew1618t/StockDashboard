/**
 * saulUtils.js — Shared Saul rules scoring logic.
 * Used by both normalizer.js (for dashboard_metrics evaluation data)
 * and markdownParser.js (for regex-extracted rules from markdown).
 *
 * Score = Base + Bonus - Penalty (0-100)
 *   Base:    Tier 1 all PASS → 70 | any CAUTION → 50 | any FAIL/DISQ → 0
 *   Bonus:   (Tier 2 passes / applicable) × 25
 *   Penalty: Tier 4 warnings × 2, max -10
 *
 * Conviction = High / Medium / Low (from Tier 3 signals + Tier 4 warnings)
 */

const TIER_DEFS = {
  tier1: ['R_001', 'R_001A', 'R_003', 'R_006'],
  tier2: ['R_002', 'R_004', 'R_005', 'R_007', 'R_008', 'R_009'],
  tier3: ['R_010', 'R_011', 'R_012', 'R_013', 'R_014', 'R_015', 'R_016', 'R_017'],
  tier4: ['R_018', 'R_019', 'R_020', 'R_021', 'R_022', 'R_023', 'R_024'],
};

function computeSaulSummary(rules) {
  if (!rules || Object.keys(rules).length === 0) return null;

  // Classify rules into tiers using explicit membership
  const tiers = { tier1: {}, tier2: {}, tier3: {}, tier4: {} };
  for (const [rule, status] of Object.entries(rules)) {
    if (TIER_DEFS.tier1.includes(rule)) tiers.tier1[rule] = status;
    else if (TIER_DEFS.tier2.includes(rule)) tiers.tier2[rule] = status;
    else if (TIER_DEFS.tier3.includes(rule)) tiers.tier3[rule] = status;
    else if (TIER_DEFS.tier4.includes(rule)) tiers.tier4[rule] = status;
  }

  const countStatus = (tierObj, ...statuses) =>
    Object.values(tierObj).filter(s => statuses.includes(s)).length;
  const hasStatus = (tierObj, ...statuses) =>
    Object.values(tierObj).some(s => statuses.includes(s));

  // ── Tier 1: Base Score (Hard Disqualifiers) ──
  const tier1Count = Object.keys(tiers.tier1).length;
  let baseScore;
  if (tier1Count === 0) {
    baseScore = 0;
  } else if (hasStatus(tiers.tier1, 'FAIL', 'DISQUALIFIED', 'DISQ')) {
    baseScore = 0;
  } else if (hasStatus(tiers.tier1, 'CAUTION', 'WARNING')) {
    baseScore = 50;
  } else {
    baseScore = 70;
  }

  // ── Tier 2: Bonus (Weighted Factors) ──
  const tier2NA = countStatus(tiers.tier2, 'N/A', 'INSUFFICIENT_DATA', 'UNCLEAR');
  const tier2Applicable = Object.keys(tiers.tier2).length - tier2NA;
  const tier2Passes = countStatus(tiers.tier2, 'PASS');
  const tier2Bonus = tier2Applicable > 0
    ? Math.round((tier2Passes / tier2Applicable) * 25)
    : 0;

  // ── Tier 4: Warning Penalty ──
  const tier4Warnings = countStatus(tiers.tier4, 'WARNING', 'CAUTION');
  const warningPenalty = Math.min(tier4Warnings * 2, 10);

  // ── Final Score (clamped 0-100) ──
  const score = Math.max(0, Math.min(100, baseScore + tier2Bonus - warningPenalty));

  // ── Conviction (from Tier 3 signals + Tier 4 warnings) ──
  const tier3Passes = countStatus(tiers.tier3, 'PASS');
  let conviction;
  if (tier3Passes >= 5 && tier4Warnings <= 1) conviction = 'High';
  else if (tier3Passes >= 3 && tier4Warnings <= 3) conviction = 'Medium';
  else conviction = 'Low';

  return {
    tiers,
    score,
    conviction,
    baseScore,
    tier2Bonus,
    warningPenalty,
    tier1Count,
    tier2Passes,
    tier2Applicable,
    tier3Passes,
    tier4Warnings,
  };
}

module.exports = { computeSaulSummary };
