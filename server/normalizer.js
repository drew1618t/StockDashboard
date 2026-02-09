/**
 * normalizer.js — Converts 4 different JSON schema families into one unified data model.
 *
 * Schema families detected:
 *   DAVE-style:  flat quantitative, revenue in millions, business_model is string
 *   CRDO-style:  flat quantitative, revenue in raw dollars, business_model is object
 *   UPST-style:  CRDO + pe_compression_analysis, forward_estimates, market_cap as "$3.4B"
 *   AMD-style:   nested quantitative (price_and_valuation, income_statement, etc.)
 *   dashboard_metrics: unified AMD-style + evaluation section (preferred source)
 */

const { computeSaulSummary } = require('./saulUtils');

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeNum(v) {
  if (v === null || v === undefined || v === 'N/A' || v === 'N/a' || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    // Strip $, commas, whitespace
    let s = v.replace(/[$,\s]/g, '');
    // Handle suffixes: 3.4B, 14.4M, 500K
    const suffixMatch = s.match(/^([+-]?[\d.]+)\s*([BMKbmk])$/);
    if (suffixMatch) {
      const num = parseFloat(suffixMatch[1]);
      const suffix = suffixMatch[2].toUpperCase();
      if (suffix === 'B') return num * 1000;   // return in millions
      if (suffix === 'M') return num;           // already millions
      if (suffix === 'K') return num / 1000;    // convert to millions
    }
    const parsed = parseFloat(s);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function toMillions(rawValue) {
  const n = safeNum(rawValue);
  if (n === null) return null;
  // If > 100,000 assume raw dollars, divide by 1M
  // Quarterly revenue for these companies ranges from ~$10M to ~$9B
  if (Math.abs(n) > 100000) return n / 1_000_000;
  return n;
}

function dig(obj, ...paths) {
  for (const path of paths) {
    let v = obj;
    for (const key of path.split('.')) {
      if (v == null) break;
      v = v[key];
    }
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

function dateToQuarter(dateStr) {
  if (!dateStr) return null;
  // Handle "2025-09-30" format
  const m = dateStr.match(/(\d{4})-(\d{2})/);
  if (!m) return dateStr; // already a quarter label
  const year = m[1];
  const month = parseInt(m[2]);
  if (month <= 3) return `Q1 ${year}`;
  if (month <= 6) return `Q2 ${year}`;
  if (month <= 9) return `Q3 ${year}`;
  return `Q4 ${year}`;
}

/**
 * Map a quarter_end date to the calendar quarter that the quarter's activity
 * mostly falls within. A fiscal quarter ending on Nov 1 covers Aug–Oct activity,
 * which is calendar Q3. We subtract 6 weeks from the end date to find the
 * midpoint of the ~3-month period.
 */
function dateToCalendarQuarter(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const endDate = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  // Subtract 6 weeks (42 days) to approximate the midpoint of the quarter
  const midDate = new Date(endDate.getTime() - 42 * 24 * 60 * 60 * 1000);
  const midMonth = midDate.getMonth() + 1; // 1-based
  const midYear = midDate.getFullYear();
  if (midMonth <= 3) return `Q1 ${midYear}`;
  if (midMonth <= 6) return `Q2 ${midYear}`;
  if (midMonth <= 9) return `Q3 ${midYear}`;
  return `Q4 ${midYear}`;
}

// ── Main Normalizer ──────────────────────────────────────────────────────────

function normalizeCompany(raw) {
  const q = raw.quantitative || {};
  const qual = raw.qualitative || {};
  const ev = raw.evaluation || {};

  const result = {
    ticker: raw.ticker || 'UNKNOWN',
    companyName: raw.company_name || raw.companyName || raw.ticker || '',
    fetchDate: raw.fetch_date || raw.fetchDate || null,

    // Price & Valuation
    price: extractPrice(q, raw),
    marketCapMil: extractMarketCap(q, raw),
    trailingPe: safeNum(dig(q, 'trailing_pe', 'price_and_valuation.trailing_pe')),
    runRatePe: safeNum(dig(q, 'run_rate_pe', 'price_and_valuation.run_rate_pe')),
    forwardPe: safeNum(dig(q, 'forward_pe', 'price_and_valuation.forward_pe')),
    priceToSales: safeNum(dig(q, 'price_to_sales_ratio', 'price_to_sales', 'price_to_sales_ttm', 'price_and_valuation.price_to_sales_ratio')),
    normalizedPe: safeNum(dig(q, 'normalized_pe_ratio', 'price_and_valuation.normalized_pe_ratio')),

    // Revenue
    revenueRecentMil: extractRevenue(q),
    revenueRecentLabel: dig(q, 'revenue_recent_quarter_period', 'income_statement.revenue_recent_quarter_period', 'income_statement.revenue_recent_quarter_label') || '',
    revenueYoyPct: safeNum(dig(q, 'revenue_yoy_pct', 'revenue_yoy_growth_pct', 'income_statement.revenue_yoy_pct', 'income_statement.revenue_yoy_percent')),
    revenueQoqPct: safeNum(dig(q, 'revenue_qoq_pct', 'revenue_qoq_growth_pct', 'income_statement.revenue_qoq_pct', 'income_statement.revenue_qoq_percent')),

    // Profitability
    grossMarginPct: safeNum(dig(q, 'gross_margin_pct', 'income_statement.gross_margin_pct', 'income_statement.gross_margin_percent')),
    netIncomeMil: toMillions(dig(q, 'net_income_recent', 'income_statement.net_income_recent')),
    netIncomeYoyPct: safeNum(dig(q, 'net_income_yoy_pct', 'income_statement.net_income_yoy_pct', 'income_statement.net_income_yoy_percent')),
    ebitdaMil: toMillions(dig(q, 'ebitda_recent', 'profitability_and_ebitda.ebitda_recent', 'profitability_and_ebitda.adj_ebitda_recent')),
    ebitdaYoyPct: safeNum(dig(q, 'ebitda_yoy_pct', 'profitability_and_ebitda.ebitda_yoy_pct', 'profitability_and_ebitda.adj_ebitda_yoy_percent')),
    ebitdaMarginPct: safeNum(dig(q, 'ebitda_margin_pct', 'profitability_and_ebitda.ebitda_margin_pct', 'profitability_and_ebitda.ebitda_margin_percent')),
    epsDiluted: safeNum(dig(q, 'eps_diluted', 'income_statement.eps_diluted')),

    // Cash Flow
    operatingCashFlowMil: toMillions(dig(q, 'operating_cash_flow', 'cash_flow.operating_cash_flow', 'cash_flow.operating_cash_flow_recent')),
    capitalExpenditureMil: toMillions(dig(q, 'capital_expenditure', 'cash_flow.capital_expenditure')),
    freeCashFlowMil: toMillions(dig(q, 'free_cash_flow', 'cash_flow.free_cash_flow')),
    capexToOcfRatio: safeNum(dig(q, 'capex_to_ocf_ratio', 'cash_flow.capex_to_ocf_ratio', 'cash_flow.capex_to_ocf_ratio_percent')),

    // Balance Sheet
    cashPositionMil: toMillions(dig(q, 'cash_and_equivalents', 'balance_sheet.cash_and_equivalents', 'balance_sheet.total_cash')),
    debtLevel: extractDebtLevel(q),

    // 52-Week Range
    fiftyTwoWeekHigh: safeNum(dig(q, '52_week_high', 'price_and_valuation.52_week_high')),
    fiftyTwoWeekLow: safeNum(dig(q, '52_week_low', 'price_and_valuation.52_week_low')),

    // Shares
    sharesYoyChangePct: safeNum(dig(q, 'shares_yoy_change_pct', 'price_and_valuation.shares_yoy_change_pct')),

    // P/E Compression (pre-computed if available)
    peCompression: extractPeCompression(q),

    // Quarterly History
    quarterlyHistory: extractQuarterlyHistory(q),

    // Forward Estimates
    forwardEstimates: extractForwardEstimates(q),

    // Full Year Results
    fullYearResults: extractFullYearResults(q),

    // Qualitative - Business
    businessDescription: extractBusinessDescription(qual),
    revenueModel: extractRevenueModel(qual),
    products: extractProducts(qual),
    isCapitalIntensive: extractCapitalIntensive(qual),

    // Market
    tamEstimate: extractTam(qual),
    marketShareEstimate: dig(qual, 'market.market_share_estimate', 'market.market_share_metrics', 'market.current_market_share') || null,
    competitors: extractCompetitors(qual),
    competitiveMoat: dig(qual, 'market.competitive_moat', 'market.competitive_position') || null,

    // Geography
    headquarters: dig(qual, 'geography.headquarters', 'geography.headquarters_address') || null,

    // Management
    ceoName: extractCeoName(qual),
    ceoTitle: extractCeoTitle(qual),
    insiderOwnershipPct: extractInsiderOwnership(qual),
    recentInsiderBuying: dig(qual, 'management.recent_insider_buying') || false,
    recentInsiderSelling: dig(qual, 'management.recent_insider_selling') || false,

    // Growth
    primaryGrowthDrivers: extractGrowthDrivers(qual),

    // Recent Developments
    latestQuarterHighlights: extractArray(qual, 'recent_developments.latest_quarter_highlights', 'recent_developments'),
    guidance: dig(qual, 'recent_developments.guidance', 'forward_guidance.fy_2026_outlook', 'forward_guidance') || '',
    recentNews: extractArray(qual, 'recent_developments.recent_news'),
    redFlags: extractArray(qual, 'recent_developments.red_flags'),

    // Risk Factors
    riskFactors: extractRiskFactors(qual),

    // Profitability Path
    currentlyProfitable: extractProfitableStatus(qual),
    pathToProfitabilityNotes: dig(qual, 'path_to_profitability.notes', 'path_to_profitability.current_status', 'path_to_profitability.profitability_drivers') || '',

    // Valuation Context
    valuationContext: dig(qual, 'valuation_context') || null,

    // Evaluation (from dashboard_metrics.json evaluation section)
    verdict: ev.verdict || null,
    convictionScore: safeNum(ev.conviction_score) || null,
    confidenceLevel: ev.confidence_level || null,
    keyStrengths: Array.isArray(ev.key_strengths) ? ev.key_strengths : [],
    keyConcerns: Array.isArray(ev.key_concerns) ? ev.key_concerns : [],
    bullCase: Array.isArray(ev.key_strengths) && ev.key_strengths.length > 0 ? ev.key_strengths : [],
    bearCase: Array.isArray(ev.key_concerns) && ev.key_concerns.length > 0 ? ev.key_concerns : [],
    saulRules: (ev.rule_statuses && typeof ev.rule_statuses === 'object') ? ev.rule_statuses : null,
    saulSummary: null,
  };

  // Compute saulSummary from rule_statuses if available
  if (result.saulRules && Object.keys(result.saulRules).length > 0) {
    result.saulSummary = computeSaulSummary(result.saulRules);
  }

  return result;
}

// ── Extractors ───────────────────────────────────────────────────────────────

function extractPrice(q, raw) {
  return safeNum(
    dig(q, 'price', 'price_and_valuation.current_price') ||
    dig(raw, 'current_stock_price')
  );
}

function extractMarketCap(q, raw) {
  // Check for pre-computed millions value
  const mcMil = dig(q, 'market_cap_millions');
  if (mcMil !== null && typeof mcMil === 'number') return mcMil;

  // Check for billions value
  const mcBil = dig(q, 'price_and_valuation.market_cap_billions', 'market_cap_billions');
  if (mcBil !== null && typeof mcBil === 'number') return mcBil * 1000;

  // Try raw market_cap — could be number, string "$3.4B", or "N/A"
  const mc = dig(q, 'market_cap', 'price_and_valuation.market_cap');
  if (mc === null) return null;

  if (typeof mc === 'number') {
    // Raw number: if > 1B assume raw dollars
    if (mc > 1_000_000_000) return mc / 1_000_000;
    if (mc > 1_000_000) return mc; // already in millions
    return mc;
  }

  // String parsing
  return safeNum(mc);
}

function extractRevenue(q) {
  const rev = dig(q, 'revenue_recent_quarterly', 'revenue_recent_quarter', 'income_statement.revenue_recent_quarterly', 'income_statement.revenue_recent_quarter');
  return toMillions(rev);
}

function extractDebtLevel(q) {
  const dl = dig(q, 'debt_level', 'balance_sheet.debt_level');
  if (typeof dl === 'string' && ['none', 'low', 'moderate', 'high'].includes(dl.toLowerCase())) {
    return dl.toLowerCase();
  }
  const debt = dig(q, 'balance_sheet.total_debt');
  if (debt !== null && debt !== undefined && debt !== 'N/A') {
    const d = safeNum(debt);
    if (d === null || d === 0) return 'none';
    const cash = safeNum(dig(q, 'balance_sheet.total_cash', 'cash_and_equivalents'));
    if (cash !== null && d < cash * 0.3) return 'low';
    if (cash !== null && d < cash) return 'moderate';
    return 'high';
  }
  const debtStr = dig(q, 'debt_level', 'debt');
  if (debtStr === 'N/A' || debtStr === null) return 'unknown';
  return 'unknown';
}

function extractPeCompression(q) {
  const pca = dig(q, 'pe_compression_analysis');
  if (pca) {
    return {
      trailingPe: safeNum(pca.trailing_pe),
      runRatePe: safeNum(pca.run_rate_pe),
      forwardPe: safeNum(pca.forward_pe),
      trailingToRunRate: safeNum(pca.trailing_to_run_rate_compression),
      runRateToForward: safeNum(pca.run_rate_to_forward_compression),
      totalCompression: safeNum(pca.total_compression),
      interpretation: pca.interpretation || null,
    };
  }
  // Build from individual values
  const t = safeNum(dig(q, 'trailing_pe', 'price_and_valuation.trailing_pe'));
  const r = safeNum(dig(q, 'run_rate_pe', 'price_and_valuation.run_rate_pe'));
  const f = safeNum(dig(q, 'forward_pe', 'price_and_valuation.forward_pe'));
  if (t === null && r === null && f === null) return null;
  return {
    trailingPe: t,
    runRatePe: r,
    forwardPe: f,
    trailingToRunRate: (t !== null && r !== null) ? t - r : null,
    runRateToForward: (r !== null && f !== null) ? r - f : null,
    totalCompression: (t !== null && f !== null) ? t - f : null,
    interpretation: null,
  };
}

function extractQuarterlyHistory(q) {
  const hist = q.quarterly_history;
  if (!Array.isArray(hist) || hist.length === 0) return [];

  return hist.map(entry => {
    const quarterEnd = entry.quarter_end || entry.quarter_end_date || entry.date || null;
    const quarter = entry.quarter || dateToQuarter(entry.date) || dateToQuarter(quarterEnd) || 'Unknown';
    const calendarQuarter = quarterEnd ? dateToCalendarQuarter(quarterEnd) : null;
    const revRaw = entry.revenue;
    const revMil = toMillions(revRaw);
    return {
      quarter,
      calendarQuarter,
      quarterEnd,
      revenueMil: revMil,
      revenueYoyPct: safeNum(entry.revenue_yoy_pct ?? entry.yoy_growth),
      revenueQoqPct: safeNum(entry.revenue_qoq_pct ?? entry.qoq_growth),
      ebitdaMil: entry.ebitda !== undefined ? toMillions(entry.ebitda) : null,
      ebitdaMarginPct: safeNum(entry.ebitda_margin_pct),
      grossMarginPct: safeNum(entry.gross_margin_pct),
      notes: entry.notes || null,
    };
  });
}

function extractForwardEstimates(q) {
  const fe = dig(q, 'forward_estimates');
  if (!fe) {
    // Try DAVE-style individual fields
    const eps2025 = safeNum(dig(q, 'estimated_eps_2025'));
    const epsGrowth = safeNum(dig(q, 'estimated_eps_2026_growth_pct'));
    if (eps2025 === null && epsGrowth === null) return null;
    return {
      fy2025Eps: eps2025,
      fy2026EpsGrowthPct: epsGrowth,
    };
  }
  return {
    fy2025RevenueMil: toMillions(fe.fy2025_revenue),
    fy2025Eps: safeNum(fe.fy2025_eps),
    fy2026RevenueMil: toMillions(fe.fy2026_revenue),
    fy2026Eps: safeNum(fe.fy2026_eps),
    fy2026RevenueGrowthPct: safeNum(fe.fy2026_revenue_growth_pct),
  };
}

function extractFullYearResults(q) {
  const fyr = dig(q, 'full_year_results');
  if (!fyr) return null;
  const result = {};
  for (const [key, val] of Object.entries(fyr)) {
    result[key] = {
      revenueMil: toMillions(val.revenue),
      revenueYoyPct: safeNum(val.revenue_yoy_pct),
      ebitdaMil: toMillions(val.ebitda),
      ebitdaYoyPct: safeNum(val.ebitda_yoy_pct),
      netIncomeMil: toMillions(val.net_income),
    };
  }
  return result;
}

function extractBusinessDescription(qual) {
  const bm = qual.business_model;
  if (!bm) return '';
  if (typeof bm === 'string') return bm;
  return bm.description || bm.summary || bm.company_description || '';
}

function extractRevenueModel(qual) {
  const bm = qual.business_model;
  if (!bm) return '';
  if (typeof bm === 'object') return bm.revenue_model || '';
  // DAVE-style: check revenue_streams
  if (Array.isArray(qual.revenue_streams)) {
    return qual.revenue_streams.map(s => s.stream || s.name || '').join(', ');
  }
  return '';
}

function extractProducts(qual) {
  const bm = qual.business_model;
  if (!bm) return [];
  if (typeof bm === 'object') {
    const p = bm.products || bm.key_products || [];
    if (Array.isArray(p)) return p.map(x => typeof x === 'string' ? x : x.name || String(x));
  }
  // DAVE-style
  if (Array.isArray(qual.revenue_streams)) {
    return qual.revenue_streams.map(s => s.stream || s.description || '');
  }
  return [];
}

function extractCapitalIntensive(qual) {
  const bm = qual.business_model;
  if (bm && typeof bm === 'object' && 'is_capital_intensive' in bm) {
    return bm.is_capital_intensive;
  }
  return false;
}

function extractTam(qual) {
  return dig(qual,
    'market.tam_estimate',
    'market.tam_description',
    'market.tam_size',
    'market.tam_current'
  ) || null;
}

function extractCompetitors(qual) {
  const comp = dig(qual, 'market.competitors');
  if (Array.isArray(comp)) return comp.map(c => typeof c === 'string' ? c : c.name || String(c));
  return [];
}

function extractCeoName(qual) {
  // Object with .name
  const ceo = dig(qual, 'management.ceo');
  if (ceo && typeof ceo === 'object') return ceo.name || '';
  if (typeof ceo === 'string') return ceo;
  // key_executives array
  const execs = dig(qual, 'management.key_executives');
  if (Array.isArray(execs) && execs.length > 0) return execs[0].name || '';
  return '';
}

function extractCeoTitle(qual) {
  const ceo = dig(qual, 'management.ceo');
  if (ceo && typeof ceo === 'object') return ceo.title || '';
  const ct = dig(qual, 'management.ceo_title');
  if (ct) return ct;
  const execs = dig(qual, 'management.key_executives');
  if (Array.isArray(execs) && execs.length > 0) return execs[0].title || '';
  return '';
}

function extractInsiderOwnership(qual) {
  const pct = dig(qual, 'management.insider_ownership', 'management.insider_ownership_pct', 'management.total_insider_ownership_pct');
  if (pct === null) return null;
  const n = safeNum(String(pct).replace(/%/g, ''));
  return n;
}

function extractGrowthDrivers(qual) {
  const gd = dig(qual, 'growth_drivers');
  if (Array.isArray(gd)) return gd.map(x => typeof x === 'string' ? x : String(x));
  if (gd && typeof gd === 'object') {
    const pd = gd.primary_drivers;
    if (Array.isArray(pd)) return pd;
  }
  // risks_and_concerns style (AMD)
  return [];
}

function extractArray(qual, ...paths) {
  for (const path of paths) {
    const parts = path.split('.');
    let v = qual;
    for (const part of parts) {
      if (v == null) break;
      v = v[part];
    }
    if (Array.isArray(v)) return v.map(x => typeof x === 'string' ? x : (x.details || x.description || JSON.stringify(x)));
  }
  return [];
}

function extractRiskFactors(qual) {
  const rf = dig(qual, 'risk_factors');
  if (Array.isArray(rf)) {
    return rf.map(r => {
      if (typeof r === 'string') return { category: 'General', description: r, severity: 'Medium' };
      return {
        category: r.category || 'General',
        description: r.description || String(r),
        severity: r.severity || 'Medium',
      };
    });
  }
  // AMD-style: risks_and_concerns as array of strings
  const rac = dig(qual, 'risks_and_concerns');
  if (Array.isArray(rac)) {
    return rac.map(r => ({ category: 'General', description: String(r), severity: 'Medium' }));
  }
  // recent_developments.red_flags
  const flags = dig(qual, 'recent_developments.red_flags');
  if (Array.isArray(flags)) {
    return flags.map(r => ({ category: 'Warning', description: String(r), severity: 'Medium' }));
  }
  return [];
}

function extractProfitableStatus(qual) {
  const ptp = dig(qual, 'path_to_profitability');
  if (ptp && typeof ptp === 'object') {
    if ('currently_profitable' in ptp) return !!ptp.currently_profitable;
    const status = ptp.current_status || '';
    if (/profitable/i.test(status)) return true;
  }
  const fh = dig(qual, 'financial_health.profitability');
  if (fh && /profitable/i.test(String(fh))) return true;
  return null;
}

module.exports = { normalizeCompany, safeNum, toMillions, dateToCalendarQuarter };
