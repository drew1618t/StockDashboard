/**
 * markdownParser.js — Extracts structured data from Saul-style investment analysis markdown.
 *
 * Handles two format versions:
 *   V1: "# Company Name (TICKER)" with "**Verdict: STATUS**"
 *   V2: "# TICKER Investment Analysis" with "**Verdict:** STATUS"
 *
 * Returns a parsed object with financials, Saul rules, verdict, bull/bear cases, etc.
 */

const { computeSaulSummary } = require('./saulUtils');

function parseMarkdown(markdownText, ticker) {
  if (!markdownText || typeof markdownText !== 'string') {
    return null;
  }

  const md = markdownText;

  return {
    ticker: ticker || extractTicker(md),
    date: extractDate(md),
    price: extractPrice(md),
    marketCap: extractMarketCap(md),
    verdict: extractVerdict(md),
    convictionScore: extractConvictionScore(md),

    // Financial metrics from markdown
    financials: extractFinancials(md),

    // P/E compression from markdown
    peValues: extractPeValues(md),

    // Unit economics
    unitEconomics: extractUnitEconomics(md),

    // Saul's rules evaluation
    saulRules: extractSaulRules(md),
    saulSummary: computeSaulSummary(extractSaulRules(md)),

    // Investment thesis
    bullCase: extractBullBearCase(md, 'bull'),
    bearCase: extractBullBearCase(md, 'bear'),

    // Risks
    risks: extractRisks(md),

    // Quarterly revenue history (if present in markdown)
    quarterlyHistory: extractQuarterlyHistory(md),

    // Raw markdown for rendering
    rawMarkdown: md,
  };
}

// ── Extraction Functions ─────────────────────────────────────────────────────

function extractTicker(md) {
  // V1: "# Company Name (TICKER)"
  let m = md.match(/^#\s+.+?\((\w+)\)/m);
  if (m) return m[1];
  // V2: "# TICKER Investment Analysis"
  m = md.match(/^#\s+(\w+)\s+Investment Analysis/m);
  if (m) return m[1];
  return null;
}

function extractDate(md) {
  const m = md.match(/\*\*Date:\*\*\s*(.+?)(?:\s*\||\s*$)/m);
  if (m) return m[1].trim();
  return null;
}

function extractPrice(md) {
  const m = md.match(/\*\*Price:\*\*\s*\$?([\d,.]+)/);
  if (m) return parseFloat(m[1].replace(/,/g, ''));
  return null;
}

function extractMarketCap(md) {
  const m = md.match(/\*\*Market Cap:\*\*\s*\$?([\d.]+[BMKbmk]?)/);
  if (m) return m[1];
  return null;
}

function extractVerdict(md) {
  // "**Verdict: DISQUALIFIED**" or "**Verdict:** PASS"
  let m = md.match(/\*\*Verdict:?\s*\*?\*?\s*(PASS|CAUTION|DISQUALIFIED|FAIL|STRONG\s*PASS|WATCH)/i);
  if (m) return m[1].trim().toUpperCase();
  m = md.match(/\*\*Verdict:\*\*\s*(PASS|CAUTION|DISQUALIFIED|FAIL|STRONG\s*PASS|WATCH)/i);
  if (m) return m[1].trim().toUpperCase();
  return null;
}

function extractConvictionScore(md) {
  const m = md.match(/\*\*Conviction Score:\*\*\s*([\d.]+)\s*\/\s*10/);
  if (m) return parseFloat(m[1]);
  return null;
}

function extractFinancials(md) {
  const result = {};
  let m;

  // Revenue — V1: "**Revenue:** $150.7M (+63% YoY, +14.4% QoQ)"
  //           V2: "- Revenue: $164.0M (+62% YoY, +8.7% QoQ)"
  m = md.match(/(?:\*\*)?Revenue:?\*?\*?\s*\$?([\d,.]+)([BMK]?)\s*\(([^)]+)\)/);
  if (m) {
    result.revenue = m[1] + (m[2] || '');
    const parts = m[3];
    const yoy = parts.match(/([+-]?[\d.]+)%\s*YoY/);
    const qoq = parts.match(/([+-]?[\d.]+)%\s*QoQ/);
    if (yoy) result.revenueYoyPct = parseFloat(yoy[1]);
    if (qoq) result.revenueQoqPct = parseFloat(qoq[1]);
  }

  // Gross Margin — both "**Gross Margin:** 70%" and "- Gross Margin: 76.4%"
  m = md.match(/(?:\*\*)?Gross Margin:?\*?\*?\s*([\d.]+)%/);
  if (m) result.grossMarginPct = parseFloat(m[1]);

  // Net Profit Margin
  m = md.match(/(?:\*\*)?Net (?:Profit )?Margin:?\*?\*?\s*([\d.]+)%/);
  if (m) result.netProfitMarginPct = parseFloat(m[1]);

  // EBITDA Margin
  m = md.match(/(?:\*\*)?(?:Adjusted )?EBITDA Margin:?\*?\*?\s*~?([\d.]+)%/);
  if (m) result.ebitdaMarginPct = parseFloat(m[1]);

  // Operating Leverage — "**Operating Leverage:** 9.53x" or "- Operating Leverage: **7.77**"
  m = md.match(/Operating Leverage:?\s*\*?\*?\s*([\d.]+)x?/);
  if (m) result.operatingLeverage = parseFloat(m[1]);

  // FCF — "**Free Cash Flow:** $38.5M" or "- Free Cash Flow: Positive"
  m = md.match(/(?:\*\*)?Free Cash Flow:?\*?\*?\s*\$?([\d,.]+)([BMK]?)/);
  if (m) result.freeCashFlow = m[1] + (m[2] || '');

  // Dilution
  m = md.match(/(?:\*\*)?Dilution:?\*?\*?\s*([+-]?[\d.]+)%/);
  if (m) result.dilutionPct = parseFloat(m[1]);

  // FCF Margin
  m = md.match(/(?:\*\*)?FCF Margin:?\*?\*?\s*([\d.]+)%/);
  if (m) result.fcfMarginPct = parseFloat(m[1]);

  return result;
}

function extractPeValues(md) {
  const result = {};
  let m;

  // Trailing P/E — "**Trailing P/E:** 114.59x" or "Trailing P/E: 114.59x"
  m = md.match(/Trailing P\/E:?\s*\*?\*?\s*([\d.]+)x/);
  if (m) result.trailingPe = parseFloat(m[1]);

  // Run Rate P/E
  m = md.match(/Run[- ]?Rate P\/E:?\s*\*?\*?\s*([\d.]+)x/);
  if (m) result.runRatePe = parseFloat(m[1]);

  // Forward P/E
  m = md.match(/Forward P\/E[^:]*:?\s*\*?\*?\s*([\d.]+)x/);
  if (m) result.forwardPe = parseFloat(m[1]);

  // Normalized P/E — "Normalized P/E: 14.27x"
  m = md.match(/Normalized P\/E:?\s*\*?\*?\s*([\d.]+)x/);
  if (m) result.normalizedPe = parseFloat(m[1]);

  // Price-to-Sales — "Price-to-Sales: 5.02x" or "P/S: 5.02x"
  m = md.match(/(?:Price-to-Sales|P\/S):?\s*\*?\*?\s*([\d.]+)x/);
  if (m) result.priceToSales = parseFloat(m[1]);

  // Compression values
  if (result.trailingPe && result.runRatePe) {
    result.trailingToRunRate = Math.round((result.trailingPe - result.runRatePe) * 100) / 100;
  }
  if (result.runRatePe && result.forwardPe) {
    result.runRateToForward = Math.round((result.runRatePe - result.forwardPe) * 100) / 100;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function extractUnitEconomics(md) {
  const result = {};
  let m;

  // CAC
  m = md.match(/(?:CAC|customer acquisition cost)[^$]*\$?([\d,.]+)/i);
  if (m) result.cac = parseFloat(m[1].replace(/,/g, ''));

  // ARPU
  m = md.match(/ARPU[^$]*\$?([\d,.]+)/i);
  if (m) result.arpu = parseFloat(m[1].replace(/,/g, ''));

  // ARPU-to-CAC ratio
  if (result.cac && result.arpu) {
    result.arpuToCacRatio = Math.round((result.arpu / result.cac) * 10) / 10;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function extractSaulRules(md) {
  const rules = {};
  const statusWords = 'PASS|FAIL|WARNING|CAUTION|N\\/A|UNCLEAR|INSUFFICIENT[_ ]DATA|PARTIAL|CONTEXT';
  let match;

  // Format 1: Table with square brackets — | R_001 (desc) | [PASS] | evidence |
  const bracketPattern = new RegExp(
    `\\|\\s*\\*?\\*?R[_-]?(\\d+[A-Za-z]?)\\s*[^|]*\\|\\s*\\[?(${statusWords})\\]?\\s*\\|`,
    'gi'
  );
  while ((match = bracketPattern.exec(md)) !== null) {
    const ruleNum = match[1];
    const status = match[2].toUpperCase().replace(/\s+/g, '_');
    rules[`R_${ruleNum.padStart(3, '0')}`] = status;
  }

  // Format 2: Table with emoji — | R_001: desc | ✅ PASS | evidence |
  const emojiPattern = new RegExp(
    `\\|\\s*\\*?\\*?R[_-]?(\\d+[A-Za-z]?)\\s*[^|]*\\|\\s*[\\u2705\\u274C\\u26A0\\uFE0F\\u2B55\\uD83D\\uDFE1\\u2139\\uFE0F\\u26AA]*\\s*\\*?\\*?(${statusWords})\\*?\\*?\\s*\\|`,
    'gi'
  );
  while ((match = emojiPattern.exec(md)) !== null) {
    const ruleNum = match[1];
    const status = match[2].toUpperCase().replace(/\s+/g, '_');
    const key = `R_${ruleNum.padStart(3, '0')}`;
    if (!rules[key]) rules[key] = status;
  }

  // Format 3: Inline bold — **R_001 - Rule Name: PASS**
  const inlinePattern = new RegExp(
    `\\*\\*R[_-]?(\\d+[A-Za-z]?)\\s*[-–—:]\\s*[^*]*?:\\s*(${statusWords})\\*\\*`,
    'gi'
  );
  while ((match = inlinePattern.exec(md)) !== null) {
    const ruleNum = match[1];
    const status = match[2].toUpperCase().replace(/\s+/g, '_');
    const key = `R_${ruleNum.padStart(3, '0')}`;
    if (!rules[key]) rules[key] = status;
  }

  return rules;
}

function extractBullBearCase(md, type) {
  const label = type === 'bull' ? 'Bull Case' : 'Bear Case';

  // Try "**Bull Case:**" section first
  let pattern = new RegExp(`\\*\\*${label}:?\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*(?:Bull|Bear)|\\n##|$)`, 'i');
  let m = md.match(pattern);

  // Also try "## Bull Case" as a section header
  if (!m) {
    pattern = new RegExp(`##\\s*${label}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
    m = md.match(pattern);
  }

  if (!m) return [];

  // Extract bullet points
  const lines = m[1].split('\n')
    .map(l => l.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(l => l.length > 0 && !l.startsWith('|') && !l.startsWith('---'));
  return lines;
}

function extractQuarterlyHistory(md) {
  const results = [];

  // Match "**Quarterly Revenue History:**" or "Quarterly Revenue History:" sections
  // Format: "- Q4 2024: $100.9M (+38% YoY)"
  //     or: "- Q1 2025: $108.0M (+47% YoY, +7.1% QoQ)"
  const sectionMatch = md.match(/\*?\*?Quarterly Revenue History:?\*?\*?\s*\n([\s\S]*?)(?=\n\*\*|\n##|\n\n[A-Z]|$)/i);
  if (sectionMatch) {
    const lines = sectionMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/[-*]\s*Q([1-4])\s*(\d{4}):\s*\$?([\d,.]+)([BMK]?)\s*(?:\(([^)]*)\))?/);
      if (m) {
        const quarter = `Q${m[1]} ${m[2]}`;
        let revStr = m[3].replace(/,/g, '');
        let revMil = parseFloat(revStr);
        const suffix = (m[4] || '').toUpperCase();
        if (suffix === 'B') revMil *= 1000;
        else if (suffix === 'K') revMil /= 1000;
        // If no suffix and value > 100, assume it's already in millions
        // If value > 100000, it's raw dollars
        if (!suffix && revMil > 100000) revMil /= 1000000;

        let yoyPct = null, qoqPct = null;
        if (m[5]) {
          const yoyMatch = m[5].match(/([+-]?[\d.]+)%\s*YoY/);
          const qoqMatch = m[5].match(/([+-]?[\d.]+)%\s*QoQ/);
          if (yoyMatch) yoyPct = parseFloat(yoyMatch[1]);
          if (qoqMatch) qoqPct = parseFloat(qoqMatch[1]);
        }

        results.push({
          quarter,
          revenueMil: revMil,
          revenueYoyPct: yoyPct,
          revenueQoqPct: qoqPct,
        });
      }
    }
  }

  return results;
}

function extractRisks(md) {
  // Find ## Risks section
  const m = md.match(/##\s*Risks?\s*(?:&|and)?\s*Concerns?\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (!m) return [];

  const lines = m[1].split('\n')
    .map(l => l.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter(l => l.length > 10); // skip short/empty lines
  return lines;
}

module.exports = { parseMarkdown };
