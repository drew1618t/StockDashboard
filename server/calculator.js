/**
 * calculator.js — Derived metrics computed from normalized company data.
 *
 * All functions accept normalized company objects (from normalizer.js)
 * and return computed values. Null-safe: returns null when inputs are missing.
 */

/**
 * Sequential Momentum Indicator
 * Compares current QoQ growth to previous QoQ growth.
 * Returns: { currentQoq, priorQoq, delta, trend: 'accelerating'|'stable'|'decelerating' }
 */
function sequentialMomentum(company) {
  const hist = company.quarterlyHistory;
  if (!hist || hist.length < 3) return null;

  // Compute QoQ from revenue if not directly available
  let currentQoq, priorQoq;

  if (hist[0].revenueQoqPct !== null && hist[0].revenueQoqPct !== undefined) {
    currentQoq = hist[0].revenueQoqPct;
  } else if (hist[0].revenueMil && hist[1].revenueMil) {
    currentQoq = ((hist[0].revenueMil - hist[1].revenueMil) / hist[1].revenueMil) * 100;
  } else {
    return null;
  }

  if (hist[1].revenueQoqPct !== null && hist[1].revenueQoqPct !== undefined) {
    priorQoq = hist[1].revenueQoqPct;
  } else if (hist[1].revenueMil && hist[2].revenueMil) {
    priorQoq = ((hist[1].revenueMil - hist[2].revenueMil) / hist[2].revenueMil) * 100;
  } else {
    return null;
  }

  const delta = currentQoq - priorQoq;
  let trend;
  if (delta > 2) trend = 'accelerating';
  else if (delta < -2) trend = 'decelerating';
  else trend = 'stable';

  return {
    currentQoq: Math.round(currentQoq * 100) / 100,
    priorQoq: Math.round(priorQoq * 100) / 100,
    delta: Math.round(delta * 100) / 100,
    trend,
  };
}

/**
 * Growth-Adjusted Valuation (GAV) — PEG-like ratio
 * Uses run-rate P/E (or trailing/normalized fallback) divided by growth rate.
 * Lower = cheaper relative to growth.
 * Example: Run-rate P/E 26.78, 71% growth → 26.78 / 71 = 0.38
 */
function growthAdjustedValuation(company) {
  const pe = company.runRatePe || company.trailingPe || company.normalizedPe;
  const growth = company.revenueYoyPct;
  if (!pe || !growth || growth <= 0) return null;
  return Math.round((pe / growth) * 100) / 100;
}

/**
 * Operating Leverage Ratio (dollar-based)
 * Measures incremental EBITDA per dollar of incremental revenue.
 * Formula: ΔEBITDA / ΔRevenue (back-calculated from current values + YoY %).
 * > 0.5 = strong margin expansion. Typical range: 0.1 – 1.0.
 */
function operatingLeverage(company) {
  const currentEBITDA = company.ebitdaMil;
  const currentRevenue = company.revenueRecentMil;
  const ebitdaYoY = company.ebitdaYoyPct;
  const revenueYoY = company.revenueYoyPct;

  if (currentEBITDA == null || currentRevenue == null ||
      ebitdaYoY == null || revenueYoY == null ||
      revenueYoY === 0 || ebitdaYoY === -100) return null;

  // Back-calculate prior-year values from current + YoY growth
  const priorEBITDA = currentEBITDA / (1 + ebitdaYoY / 100);
  const priorRevenue = currentRevenue / (1 + revenueYoY / 100);
  const revenueDelta = currentRevenue - priorRevenue;
  if (revenueDelta === 0) return null;

  const ebitdaDelta = currentEBITDA - priorEBITDA;
  return Math.round((ebitdaDelta / revenueDelta) * 100) / 100;
}

/**
 * Distance from 52-Week High (%)
 * Negative = below high. E.g., -25% means 25% below the 52-week high.
 */
function distanceFrom52WeekHigh(company) {
  const price = company.price;
  const high = company.fiftyTwoWeekHigh;
  if (!price || !high) return null;
  return Math.round(((price - high) / high) * 10000) / 100;
}

/**
 * P/E Compression Analysis
 * Shows how P/E ratios compress from trailing → run rate → forward.
 * Positive values = compression (improving), meaning P/E is dropping.
 */
function peCompression(company) {
  // Use pre-computed if available
  if (company.peCompression) return company.peCompression;

  const t = company.trailingPe;
  const r = company.runRatePe;
  const f = company.forwardPe;

  if (t === null && r === null && f === null) return null;

  return {
    trailingPe: t,
    runRatePe: r,
    forwardPe: f,
    trailingToRunRate: (t !== null && r !== null) ? Math.round((t - r) * 100) / 100 : null,
    runRateToForward: (r !== null && f !== null) ? Math.round((r - f) * 100) / 100 : null,
    totalCompression: (t !== null && f !== null) ? Math.round((t - f) * 100) / 100 : null,
  };
}

/**
 * Compute all derived metrics for a single company.
 */
function computeAllMetrics(company) {
  return {
    ticker: company.ticker,
    momentum: sequentialMomentum(company),
    gav: growthAdjustedValuation(company),
    operatingLeverage: operatingLeverage(company),
    distanceFromHigh: distanceFrom52WeekHigh(company),
    peCompression: peCompression(company),
  };
}

/**
 * Compute derived metrics for all companies and attach to each company object.
 */
function enrichCompanies(companies) {
  return companies.map(company => ({
    ...company,
    calculated: computeAllMetrics(company),
  }));
}

module.exports = {
  sequentialMomentum,
  growthAdjustedValuation,
  operatingLeverage,
  distanceFrom52WeekHigh,
  peCompression,
  computeAllMetrics,
  enrichCompanies,
};
