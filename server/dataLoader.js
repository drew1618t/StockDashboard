/**
 * dataLoader.js — Reads JSON + markdown files from the reports directory,
 * normalizes them, enriches with calculations, and caches in memory.
 *
 * Data is loaded once at startup and can be refreshed on demand via refresh().
 * Only companies listed in portfolio.json are included in API responses.
 */

const fs = require('fs');
const path = require('path');
const { normalizeCompany, dateToCalendarQuarter } = require('./normalizer');
const { parseMarkdown } = require('./markdownParser');
const { enrichCompanies } = require('./calculator');
const { computeSaulSummary } = require('./saulUtils');

const REPORTS_DIR = process.env.DATA_DIR ||
  path.join(__dirname, '..', '..', 'SaulInvesting', 'reports');

const PORTFOLIO_PATH = path.join(__dirname, '..', 'portfolio.json');

// ── In-memory cache ──────────────────────────────────────────────────────────

let cachedCompanies = [];        // Normalized + enriched company objects
let cachedAnalyses = {};         // Parsed markdown analyses keyed by ticker
let cachedRawMarkdown = {};      // Raw markdown text keyed by ticker
let lastLoadTime = null;
let portfolioHoldings = [];

// ── Loading Logic ────────────────────────────────────────────────────────────

function loadPortfolioConfig() {
  try {
    const raw = fs.readFileSync(PORTFOLIO_PATH, 'utf-8');
    const config = JSON.parse(raw);
    portfolioHoldings = (config.holdings || []).map(t => t.toUpperCase());
    console.log(`[dataLoader] Portfolio: ${portfolioHoldings.length} holdings — ${portfolioHoldings.join(', ')}`);
  } catch (err) {
    console.warn('[dataLoader] Could not read portfolio.json, showing all companies:', err.message);
    portfolioHoldings = [];
  }
}

function scanReportsDirectory() {
  if (!fs.existsSync(REPORTS_DIR)) {
    console.error(`[dataLoader] Reports directory not found: ${REPORTS_DIR}`);
    return [];
  }

  const entries = fs.readdirSync(REPORTS_DIR, { withFileTypes: true });
  const companyDirs = entries
    .filter(e => e.isDirectory() && e.name !== 'validation')
    .map(e => e.name);

  console.log(`[dataLoader] Found ${companyDirs.length} company directories in ${REPORTS_DIR}`);
  return companyDirs;
}

function findJsonFile(dirPath, ticker) {
  const files = fs.readdirSync(dirPath);
  const tickerLower = ticker.toLowerCase();

  // Prefer dashboard_metrics.json (unified format with evaluation data)
  const metricsFile = files.find(f =>
    f.toLowerCase() === `${tickerLower}_dashboard_metrics.json`
  );
  if (metricsFile) {
    console.log(`[dataLoader] ${ticker}: Using dashboard_metrics.json`);
    return path.join(dirPath, metricsFile);
  }

  // Fall back to company_data.json (legacy format)
  const jsonFile = files.find(f =>
    f.toLowerCase() === `${tickerLower}_company_data.json`
  );
  return jsonFile ? path.join(dirPath, jsonFile) : null;
}

function findLatestMarkdown(dirPath, ticker) {
  const files = fs.readdirSync(dirPath);
  // Find all markdown files matching TICKER_YYYYMMDD.md pattern
  const mdFiles = files
    .filter(f => {
      const upper = f.toUpperCase();
      return upper.startsWith(ticker.toUpperCase() + '_') && upper.endsWith('.MD');
    })
    .sort()
    .reverse(); // newest first by filename date

  return mdFiles.length > 0 ? path.join(dirPath, mdFiles[0]) : null;
}

/**
 * If the primary JSON source (dashboard_metrics) lacks quarter_end dates,
 * load the company_data.json as a fallback to get quarter_end dates and
 * compute calendarQuarter for fiscal-year companies.
 */
function backfillQuarterEndDates(normalized, dirPath, ticker, primaryJsonPath) {
  const hist = normalized.quarterlyHistory;
  if (!hist || hist.length === 0) return;

  // Check if any entries already have calendarQuarter — if so, nothing to do
  if (hist.some(q => q.calendarQuarter)) return;

  // Check if any quarter labels suggest a fiscal year (contain "FY")
  const hasFiscalQuarters = hist.some(q => q.quarter && q.quarter.includes('FY'));
  if (!hasFiscalQuarters) return;

  // Try to find the company_data.json as a secondary source
  const tickerLower = ticker.toLowerCase();
  const companyDataPath = path.join(dirPath, `${tickerLower}_company_data.json`);
  if (companyDataPath === primaryJsonPath || !fs.existsSync(companyDataPath)) return;

  try {
    const raw = JSON.parse(fs.readFileSync(companyDataPath, 'utf-8'));
    const cdHist = raw.quantitative?.quarterly_history;
    if (!Array.isArray(cdHist)) return;

    // Build a map of quarter label → quarter_end date
    const endDateMap = {};
    cdHist.forEach(entry => {
      const label = entry.quarter;
      const endDate = entry.quarter_end || entry.quarter_end_date;
      if (label && endDate) endDateMap[label] = endDate;
    });

    // Backfill into normalized data
    let backfilled = 0;
    hist.forEach(q => {
      if (!q.calendarQuarter && endDateMap[q.quarter]) {
        q.quarterEnd = endDateMap[q.quarter];
        q.calendarQuarter = dateToCalendarQuarter(endDateMap[q.quarter]);
        backfilled++;
      }
    });

    if (backfilled > 0) {
      console.log(`[dataLoader] ${ticker}: Backfilled ${backfilled} quarter_end dates from company_data.json`);
    }
  } catch (err) {
    // Silently skip — company_data is optional for this
  }
}

function loadCompany(dirPath, ticker) {
  const result = {
    ticker: ticker.toUpperCase(),
    normalized: null,
    analysis: null,
    rawMarkdown: null,
    hasJson: false,
    hasMd: false,
    errors: [],
  };

  // Load JSON
  const jsonPath = findJsonFile(dirPath, ticker);
  if (jsonPath) {
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      result.normalized = normalizeCompany(raw);
      result.hasJson = true;

      // If dashboard_metrics was used (no quarter_end dates), backfill from company_data
      backfillQuarterEndDates(result.normalized, dirPath, ticker, jsonPath);
    } catch (err) {
      result.errors.push(`JSON parse error: ${err.message}`);
      console.warn(`[dataLoader] ${ticker}: JSON error — ${err.message}`);
    }
  }

  // Load Markdown
  const mdPath = findLatestMarkdown(dirPath, ticker);
  if (mdPath) {
    try {
      const mdText = fs.readFileSync(mdPath, 'utf-8');
      result.rawMarkdown = mdText;
      result.analysis = parseMarkdown(mdText, ticker);
      result.hasMd = true;
    } catch (err) {
      result.errors.push(`MD parse error: ${err.message}`);
      console.warn(`[dataLoader] ${ticker}: MD error — ${err.message}`);
    }
  }

  // Merge markdown data into normalized object where JSON is missing values
  if (result.normalized && result.analysis) {
    mergeMarkdownIntoNormalized(result.normalized, result.analysis);
  }

  // Create minimal normalized object from markdown only (no JSON)
  if (!result.normalized && result.analysis) {
    result.normalized = buildFromMarkdownOnly(result.analysis, ticker);
  }

  return result;
}

function mergeMarkdownIntoNormalized(norm, analysis) {
  // Verdict & conviction: markdown fills gaps only (dashboard_metrics is primary)
  if (!norm.verdict && analysis.verdict) norm.verdict = analysis.verdict;
  if (!norm.convictionScore && analysis.convictionScore) norm.convictionScore = analysis.convictionScore;

  // Fill in P/E values from markdown if missing in JSON
  if (analysis.peValues) {
    if (!norm.trailingPe && analysis.peValues.trailingPe) norm.trailingPe = analysis.peValues.trailingPe;
    if (!norm.runRatePe && analysis.peValues.runRatePe) norm.runRatePe = analysis.peValues.runRatePe;
    if (!norm.forwardPe && analysis.peValues.forwardPe) norm.forwardPe = analysis.peValues.forwardPe;
    if (!norm.normalizedPe && analysis.peValues.normalizedPe) norm.normalizedPe = analysis.peValues.normalizedPe;
    if (!norm.priceToSales && analysis.peValues.priceToSales) norm.priceToSales = analysis.peValues.priceToSales;
  }

  // Fill financial metrics from markdown
  const fin = analysis.financials;
  if (fin) {
    if (!norm.ebitdaMarginPct && fin.ebitdaMarginPct) norm.ebitdaMarginPct = fin.ebitdaMarginPct;
    if (!norm.grossMarginPct && fin.grossMarginPct) norm.grossMarginPct = fin.grossMarginPct;
    if (fin.operatingLeverage) norm.mdOperatingLeverage = fin.operatingLeverage;
    if (fin.dilutionPct) norm.dilutionPct = fin.dilutionPct;
    if (fin.fcfMarginPct) norm.fcfMarginPct = fin.fcfMarginPct;
  }

  // Quarterly history from markdown (if JSON has none)
  if ((!norm.quarterlyHistory || norm.quarterlyHistory.length === 0) &&
      analysis.quarterlyHistory && analysis.quarterlyHistory.length > 0) {
    norm.quarterlyHistory = analysis.quarterlyHistory;
  }

  // Fallback: if still no quarterly history but we have current-quarter data,
  // build a single-entry array so the heatmap shows at least 1 cell
  if ((!norm.quarterlyHistory || norm.quarterlyHistory.length === 0) &&
      norm.revenueYoyPct !== null && norm.revenueYoyPct !== undefined) {
    norm.quarterlyHistory = [{
      quarter: norm.revenueRecentLabel || 'Latest',
      calendarQuarter: null,
      quarterEnd: null,
      revenueMil: norm.revenueRecentMil,
      revenueYoyPct: norm.revenueYoyPct,
      revenueQoqPct: norm.revenueQoqPct,
    }];
  }

  // Unit economics
  if (analysis.unitEconomics) norm.unitEconomics = analysis.unitEconomics;

  // Saul rules: markdown fills gaps only (dashboard_metrics evaluation is primary)
  if ((!norm.saulRules || Object.keys(norm.saulRules).length === 0) && analysis.saulRules) {
    norm.saulRules = analysis.saulRules;
    if (Object.keys(norm.saulRules).length > 0) {
      norm.saulSummary = computeSaulSummary(norm.saulRules);
    }
  }
  if (!norm.saulSummary && analysis.saulSummary) norm.saulSummary = analysis.saulSummary;

  // Bull/Bear: markdown fills gaps only (dashboard_metrics key_strengths/concerns is primary)
  if ((!norm.bullCase || norm.bullCase.length === 0) && analysis.bullCase && analysis.bullCase.length > 0) {
    norm.bullCase = analysis.bullCase;
  }
  if ((!norm.bearCase || norm.bearCase.length === 0) && analysis.bearCase && analysis.bearCase.length > 0) {
    norm.bearCase = analysis.bearCase;
  }
}

function buildFromMarkdownOnly(analysis, ticker) {
  return {
    ticker: ticker.toUpperCase(),
    companyName: ticker.toUpperCase(),
    fetchDate: analysis.date,
    price: analysis.price,
    marketCapMil: null,
    trailingPe: analysis.peValues?.trailingPe || null,
    runRatePe: analysis.peValues?.runRatePe || null,
    forwardPe: analysis.peValues?.forwardPe || null,
    normalizedPe: analysis.peValues?.normalizedPe || null,
    priceToSales: analysis.peValues?.priceToSales || null,
    revenueRecentMil: null,
    revenueYoyPct: analysis.financials?.revenueYoyPct || null,
    revenueQoqPct: analysis.financials?.revenueQoqPct || null,
    grossMarginPct: analysis.financials?.grossMarginPct || null,
    ebitdaMarginPct: analysis.financials?.ebitdaMarginPct || null,
    quarterlyHistory: analysis.quarterlyHistory || [],
    verdict: analysis.verdict,
    convictionScore: analysis.convictionScore,
    confidenceLevel: null,
    keyStrengths: [],
    keyConcerns: [],
    saulSummary: analysis.saulSummary,
    saulRules: analysis.saulRules,
    bullCase: analysis.bullCase,
    bearCase: analysis.bearCase,
    unitEconomics: analysis.unitEconomics,
    businessDescription: '',
    primaryGrowthDrivers: [],
    riskFactors: [],
    currentlyProfitable: null,
    _markdownOnly: true,
  };
}

// ── Periodic refresh ─────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = parseInt(process.env.DATA_REFRESH_INTERVAL_MS, 10) || 60 * 60 * 1000; // 1 hour

let refreshTimer = null;

function startAutoRefresh() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    console.log('[dataLoader] Auto-refreshing company data from disk...');
    try {
      loadAll();
      console.log(`[dataLoader] Auto-refresh complete — ${cachedCompanies.length} companies loaded`);
    } catch (err) {
      console.error('[dataLoader] Auto-refresh failed:', err.message);
    }
  }, REFRESH_INTERVAL_MS);
  refreshTimer.unref(); // don't keep process alive just for this timer
  console.log(`[dataLoader] Auto-refresh scheduled every ${REFRESH_INTERVAL_MS / 60000} minutes`);
}

// ── Public API ────────────────────────────────────────────────────────────────

function loadAll() {
  console.log('[dataLoader] Loading all company data...');
  loadPortfolioConfig();

  const companyDirs = scanReportsDirectory();
  const allCompanies = [];
  const analyses = {};
  const rawMarkdowns = {};

  for (const dirName of companyDirs) {
    const ticker = dirName.toUpperCase();

    // Filter by portfolio holdings (if list is non-empty)
    if (portfolioHoldings.length > 0 && !portfolioHoldings.includes(ticker)) {
      continue;
    }

    const dirPath = path.join(REPORTS_DIR, dirName);
    const result = loadCompany(dirPath, ticker);

    if (result.normalized) {
      allCompanies.push(result.normalized);
    }
    if (result.analysis) {
      analyses[ticker] = result.analysis;
    }
    if (result.rawMarkdown) {
      rawMarkdowns[ticker] = result.rawMarkdown;
    }
  }

  // Sort by ticker
  allCompanies.sort((a, b) => a.ticker.localeCompare(b.ticker));

  // Enrich with calculated metrics
  cachedCompanies = enrichCompanies(allCompanies);
  cachedAnalyses = analyses;
  cachedRawMarkdown = rawMarkdowns;
  lastLoadTime = new Date().toISOString();

  console.log(`[dataLoader] Loaded ${cachedCompanies.length} companies, ${Object.keys(analyses).length} analyses`);
  startAutoRefresh();
  return cachedCompanies;
}

function getCompanies() {
  if (cachedCompanies.length === 0) loadAll();
  return cachedCompanies;
}

function getCompany(ticker) {
  const t = ticker.toUpperCase();
  const companies = getCompanies();
  const company = companies.find(c => c.ticker === t);
  return {
    company: company || null,
    analysis: cachedAnalyses[t] || null,
    rawMarkdown: cachedRawMarkdown[t] || null,
  };
}

function refresh() {
  cachedCompanies = [];
  cachedAnalyses = {};
  cachedRawMarkdown = {};
  return loadAll();
}

function getLastLoadTime() {
  return lastLoadTime;
}

function getPortfolioHoldings() {
  return portfolioHoldings;
}

module.exports = {
  loadAll,
  getCompanies,
  getCompany,
  refresh,
  getLastLoadTime,
  getPortfolioHoldings,
};
