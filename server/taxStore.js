const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const usFederalTax = require('./usFederalTax');

const DEFAULT_TAXES_STATE_PATH = path.join(__dirname, '..', 'data', 'taxes.state.json');
const DEFAULT_TAXES_TEMPLATE_PATH = path.join(__dirname, '..', 'data', 'taxes.template.json');
const LEGACY_TAXES_PATH = path.join(__dirname, '..', 'data', 'taxes.json');

function getCurrentTaxYear(lastFiledTaxYear = null, now = new Date()) {
  const override = Number(process.env.TAX_YEAR);
  if (Number.isInteger(override) && override > 0) return override;

  const currentYear = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const isFilingSeason = month < 3 || (month === 3 && day <= 15);
  const priorTaxYear = currentYear - 1;
  const filedThrough = Number(lastFiledTaxYear || 0);

  if (isFilingSeason && filedThrough < priorTaxYear) return priorTaxYear;
  return currentYear;
}

function getDefaultState() {
  return {
    taxYear: getCurrentTaxYear(),
    method: 'fifo',
    sourceFiles: {
      positionsCsv: 'data/Drew Individual-Positions-2026-04-13-083744.csv',
      transactionHistoryPdf: 'data/Transaction History _ Charles Schwab.pdf',
    },
    carryoverLoss: 0,
    lastFiledTaxYear: null,
    planner: {
      filingStatus: 'mfj',
      taxableOrdinaryIncomeAnnual: 0,
      standardDeduction: 32200,
      plannedRothConversion: 0,
      realizedMode: 'confirmed_or_estimate',
    },
    saleConfirmations: {},
  };
}

function getTaxesPath() {
  return process.env.TAXES_STATE_PATH || DEFAULT_TAXES_STATE_PATH;
}

function resolveRepoPath(filePath) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.join(__dirname, '..', filePath);
}

function readJsonIfExists(filePath) {
  try {
    if (!filePath) return null;
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function round2(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function round4(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

function readData() {
  const taxesPath = getTaxesPath();
  const defaults = getDefaultState();
  const template = readJsonIfExists(DEFAULT_TAXES_TEMPLATE_PATH) || {};

  // Migration support: if the new state file doesn't exist but the legacy one does,
  // read legacy data so the server still comes up (deploy script copies it over too).
  const legacy = (!fs.existsSync(taxesPath) && fs.existsSync(LEGACY_TAXES_PATH))
    ? readJsonIfExists(LEGACY_TAXES_PATH)
    : null;

  try {
    const raw = readJsonIfExists(taxesPath) || legacy || null;
    if (!raw) {
      const taxYear = getCurrentTaxYear(template.lastFiledTaxYear ?? defaults.lastFiledTaxYear);
      return {
        ...defaults,
        ...template,
        taxYear,
        sourceFiles: { ...defaults.sourceFiles, ...(template.sourceFiles || {}) },
        planner: { ...defaults.planner, ...(template.planner || {}) },
        carryoverLoss: template.carryoverLoss !== undefined ? round2(Number(template.carryoverLoss)) : defaults.carryoverLoss,
        saleConfirmations: template.saleConfirmations || {},
      };
    }

    const merged = { ...defaults, ...template, ...raw };
    const taxYear = getCurrentTaxYear(merged.lastFiledTaxYear);
    return {
      ...merged,
      taxYear,
      sourceFiles: { ...defaults.sourceFiles, ...(template.sourceFiles || {}), ...(raw.sourceFiles || {}) },
      carryoverLoss: raw.carryoverLoss !== undefined
        ? round2(Number(raw.carryoverLoss))
        : (template.carryoverLoss !== undefined ? round2(Number(template.carryoverLoss)) : defaults.carryoverLoss),
      planner: { ...defaults.planner, ...(template.planner || {}), ...(raw.planner || {}) },
      saleConfirmations: raw.saleConfirmations || template.saleConfirmations || {},
    };
  } catch {
    const taxYear = getCurrentTaxYear(defaults.lastFiledTaxYear);
    return { ...defaults, taxYear };
  }
}

function writeData(data) {
  const taxesPath = getTaxesPath();
  const dir = path.dirname(taxesPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const { taxYear, carryoverLosses, account, ...persisted } = data;
  fs.writeFileSync(taxesPath, JSON.stringify(persisted, null, 2) + '\n');
}

function splitCsvRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    const next = row[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current.trim());
  return result;
}

function parseNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value || value === '--' || value === 'N/A') return null;
  const isParenthetical = value.includes('(') && value.includes(')');
  const cleaned = value.replace(/[$,%"]/g, '').replace(/[()]/g, '').replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) return null;
  return isParenthetical ? -parsed : parsed;
}

function parseMoneyToken(raw) {
  return parseNumber(raw);
}

function normalizeDate(mmddyyyy) {
  const match = String(mmddyyyy || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function getAsOfDate(asOf) {
  const match = String(asOf || '').match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return new Date().toISOString().slice(0, 10);
}

function getLotTerm(acquiredDate, asOfDate) {
  if (!acquiredDate || !asOfDate) return 'unknown';
  return daysBetween(acquiredDate, asOfDate) > 365 ? 'long' : 'short';
}

function aggregateTerm(terms) {
  const known = terms.filter(term => term === 'long' || term === 'short');
  if (known.length === 0) return 'unknown';
  const unique = new Set(known);
  if (unique.size > 1) return 'mixed';
  return unique.has('long') ? 'long' : 'short';
}

function _parsePositionsCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(line => line.trim());
  const headerIndex = lines.findIndex(line => line.includes('"Symbol"') && line.includes('"Description"'));
  if (headerIndex < 0) {
    return {
      accountLabel: null,
      asOf: null,
      positions: [],
      cash: null,
      totals: {},
    };
  }

  const header = splitCsvRow(lines[headerIndex]);
  const rows = lines.slice(headerIndex + 1).map(splitCsvRow);
  const rawAccount = lines[0] || '';
  const accountMatch = rawAccount.match(/Positions for account\s+(.+?)\s+as of/i);
  const asOfMatch = rawAccount.match(/as of\s+(.+)"?$/i);

  const positions = [];
  let cash = null;
  let totals = {};

  rows.forEach(cols => {
    const row = {};
    header.forEach((key, index) => {
      if (key) row[key] = cols[index] || '';
    });

    const symbol = (row.Symbol || '').trim();
    if (!symbol) return;

    if (symbol === 'Cash & Cash Investments') {
      cash = {
        symbol: 'CASH',
        marketValue: parseNumber(row['Mkt Val (Market Value)']),
        weightPct: parseNumber(row['% of Acct (% of Account)']),
        assetType: row['Asset Type'] || 'Cash and Money Market',
      };
      return;
    }

    if (symbol === 'Positions Total') {
      totals = {
        marketValue: parseNumber(row['Mkt Val (Market Value)']),
        costBasis: parseNumber(row['Cost Basis']),
        unrealizedGainLoss: parseNumber(row['Gain $ (Gain/Loss $)']),
        unrealizedGainLossPct: parseNumber(row['Gain % (Gain/Loss %)']),
      };
      return;
    }

    if ((row['Asset Type'] || '').toLowerCase() !== 'equity') return;

    positions.push({
      ticker: symbol.toUpperCase(),
      description: row.Description || '',
      quantity: parseNumber(row['Qty (Quantity)']),
      price: parseNumber(row.Price),
      marketValue: parseNumber(row['Mkt Val (Market Value)']),
      costBasis: parseNumber(row['Cost Basis']),
      unrealizedGainLoss: parseNumber(row['Gain $ (Gain/Loss $)']),
      unrealizedGainLossPct: parseNumber(row['Gain % (Gain/Loss %)']),
      weightPct: parseNumber(row['% of Acct (% of Account)']),
      assetType: row['Asset Type'] || '',
    });
  });

  const equityTotals = positions.reduce((sum, position) => {
    sum.marketValue += position.marketValue || 0;
    sum.costBasis += position.costBasis || 0;
    sum.unrealizedGainLoss += position.unrealizedGainLoss || 0;
    return sum;
  }, { marketValue: 0, costBasis: 0, unrealizedGainLoss: 0 });

  return {
    accountLabel: accountMatch ? accountMatch[1].trim().replace(/"/g, '') : null,
    asOf: asOfMatch ? asOfMatch[1].trim().replace(/"$/g, '') : null,
    asOfDate: getAsOfDate(asOfMatch ? asOfMatch[1].trim().replace(/"$/g, '') : null),
    positions,
    cash,
    totals: {
      ...totals,
      equityMarketValue: round2(equityTotals.marketValue),
      equityCostBasis: round2(equityTotals.costBasis),
      equityUnrealizedGainLoss: round2(equityTotals.unrealizedGainLoss),
    },
  };
}

function parseEquityTransaction(line, date, originalIndex) {
  if (/^(Buy to Open|Sell to Close)\b/i.test(line)) return null;

  const parts = line.split(/\t+/).map(part => part.trim()).filter(Boolean);
  let type;
  let ticker;
  let description;
  let detail;

  if (parts.length >= 4 && /^(Buy|Sell)$/i.test(parts[0])) {
    [type, ticker, description] = parts;
    detail = parts.slice(3).join(' ');
  } else {
    const match = line.match(/^(Buy|Sell)\s+([A-Z][A-Z0-9.]{0,7})\s+(.+?)\s+([0-9][0-9,]*(?:\.\d+)?\s+-?\$.*)$/i);
    if (!match) return null;
    [, type, ticker, description, detail] = match;
  }

  const quantityMatch = detail.match(/([0-9][0-9,]*(?:\.\d+)?)\s+(?=-?\$)/);
  const moneyMatches = detail.match(/-?\$[0-9,]+(?:\.\d+)?/g) || [];
  if (!quantityMatch || moneyMatches.length < 2) return null;

  const quantity = parseNumber(quantityMatch[1]);
  const price = parseMoneyToken(moneyMatches[0]);
  const amount = parseMoneyToken(moneyMatches[moneyMatches.length - 1]);
  if (!quantity || quantity <= 0 || price === null || amount === null) return null;

  const normalizedType = type.toLowerCase() === 'buy' ? 'buy' : 'sell';
  return {
    originalIndex,
    date,
    type: normalizedType,
    ticker: ticker.toUpperCase(),
    description: description.trim(),
    quantity,
    price: round4(price),
    amount: round2(amount),
    proceeds: normalizedType === 'sell' ? round2(amount) : null,
  };
}

function parseTransactionPage(pageText, pageOffset) {
  const lines = String(pageText || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const directRows = [];
  lines.forEach((line, index) => {
    const match = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(Buy|Sell)\s+(.+)$/);
    if (!match || /^(Buy to Open|Sell to Close)\b/i.test(match[2])) return;
    const tx = parseEquityTransaction(`${match[2]} ${match[3]}`, normalizeDate(match[1]), pageOffset + index);
    if (tx) directRows.push(tx);
  });
  if (directRows.length > 0) return directRows;

  const txLinePattern = /^(Buy|Sell|Buy to Open|Sell to Close|Credit Interest|Qualified Dividend|MoneyLink Transfer|Margin Interest)\b/i;
  const txRows = lines.filter(line => txLinePattern.test(line));
  const dates = lines.filter(line => /^\d{2}\/\d{2}\/\d{4}$/.test(line));
  if (txRows.length === 0 || dates.length === 0) return [];

  const transactionDates = dates.slice(-txRows.length);
  return txRows
    .map((line, index) => parseEquityTransaction(line, normalizeDate(transactionDates[index]), pageOffset + index))
    .filter(Boolean);
}

function _parseTransactionsText(text) {
  const pageTexts = String(text || '')
    .split(/\n(?:-- \d+ of \d+ --|--- TAX PAGE \d+ ---)\n/g)
    .filter(page => page.trim());

  let offset = 0;
  const transactions = [];
  pageTexts.forEach(pageText => {
    transactions.push(...parseTransactionPage(pageText, offset));
    offset += pageText.split(/\r?\n/).length;
  });

  return transactions;
}

function createSaleId(sale, sequence) {
  return `${sale.date}:${sale.ticker}:${round4(sale.quantity)}:${round2(sale.proceeds).toFixed(2)}:${sequence}`;
}

function getHoldingTerm(lots, saleDate) {
  if (!lots || lots.length === 0) return 'unknown';
  const terms = new Set(lots.map(lot => daysBetween(lot.acquiredDate, saleDate) > 365 ? 'long' : 'short'));
  if (terms.size > 1) return 'mixed';
  return terms.has('long') ? 'long' : 'short';
}

function _reconstructFifo(transactions, taxYear, currentPositions = []) {
  const currentTickerSet = new Set((currentPositions || []).map(position => position.ticker));
  const lotsByTicker = {};
  const realizedSales = [];
  const saleSequenceCounts = {};

  const sorted = [...transactions].sort((a, b) => {
    const dateSort = a.date.localeCompare(b.date);
    return dateSort || a.originalIndex - b.originalIndex;
  });

  sorted.forEach(tx => {
    if (!lotsByTicker[tx.ticker]) lotsByTicker[tx.ticker] = [];

    if (tx.type === 'buy') {
      lotsByTicker[tx.ticker].push({
        acquiredDate: tx.date,
        quantity: round4(tx.quantity),
        originalQuantity: round4(tx.quantity),
        unitCost: round4(tx.price),
        sourceAmount: tx.amount,
        costBasisRemaining: round2(Math.abs(tx.amount)),
      });
      return;
    }

    let remaining = tx.quantity;
    let costBasis = 0;
    const matchedLots = [];
    const lots = lotsByTicker[tx.ticker];

    for (const lot of lots) {
      if (remaining <= 0.00001) break;
      if (lot.quantity <= 0.00001) continue;

      const consumed = Math.min(lot.quantity, remaining);
      const consumesFullLot = Math.abs(consumed - lot.quantity) <= 0.00001;
      const consumedCostBasis = consumesFullLot
        ? (lot.costBasisRemaining || consumed * lot.unitCost)
        : consumed * lot.unitCost;
      costBasis += consumedCostBasis;
      lot.quantity = round4(lot.quantity - consumed);
      lot.costBasisRemaining = round2((lot.costBasisRemaining || 0) - consumedCostBasis);
      remaining = round4(remaining - consumed);
      matchedLots.push({
        acquiredDate: lot.acquiredDate,
        quantity: round4(consumed),
        unitCost: round4(lot.unitCost),
        costBasis: round2(consumedCostBasis),
      });
    }

    const year = Number(tx.date.slice(0, 4));
    if (year !== Number(taxYear)) return;

    const baseId = `${tx.date}:${tx.ticker}:${round4(tx.quantity)}:${round2(tx.proceeds).toFixed(2)}`;
    saleSequenceCounts[baseId] = (saleSequenceCounts[baseId] || 0) + 1;
    const needsData = remaining > 0.00001;
    const roundedCostBasis = round2(costBasis);
    const gainLossEstimate = needsData ? null : round2(tx.proceeds - roundedCostBasis);

    realizedSales.push({
      id: createSaleId(tx, saleSequenceCounts[baseId]),
      date: tx.date,
      ticker: tx.ticker,
      description: tx.description,
      quantity: round4(tx.quantity),
      price: round4(tx.price),
      proceeds: round2(tx.proceeds),
      costBasis: needsData ? null : roundedCostBasis,
      gainLossEstimate,
      matchedLots,
      unmatchedQuantity: needsData ? round4(remaining) : 0,
      needsData,
      closedPosition: !currentTickerSet.has(tx.ticker),
      holdingTerm: getHoldingTerm(matchedLots, tx.date),
    });
  });

  Object.keys(lotsByTicker).forEach(ticker => {
    lotsByTicker[ticker] = lotsByTicker[ticker]
      .filter(lot => lot.quantity > 0.00001)
      .map(lot => ({
        ...lot,
        quantity: round4(lot.quantity),
        costBasis: round2(lot.quantity * lot.unitCost),
      }));
  });

  return {
    lotsByTicker,
    realizedSales,
  };
}

async function extractPdfText(pdfPath) {
  const parser = new PDFParse({ data: fs.readFileSync(pdfPath) });
  try {
    const result = await parser.getText({ pageJoiner: '\n--- TAX PAGE page_number ---\n' });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function mergeConfirmations(realizedSales, confirmations) {
  return realizedSales.map(sale => {
    const confirmation = confirmations[sale.id] || null;
    const gainLossOverride = confirmation && confirmation.gainLossOverride !== null && confirmation.gainLossOverride !== undefined
      ? round2(confirmation.gainLossOverride)
      : null;
    const confirmedGainLoss = confirmation && confirmation.confirmed
      ? (gainLossOverride !== null ? gainLossOverride : sale.gainLossEstimate)
      : null;
    return {
      ...sale,
      confirmation,
      confirmed: !!(confirmation && confirmation.confirmed),
      gainLossOverride,
      confirmedGainLoss,
      needsConfirmation: sale.closedPosition && !(confirmation && confirmation.confirmed),
    };
  });
}

function buildPositions(positions, lotsByTicker, asOfDate) {
  return positions.map(position => {
    const lots = (lotsByTicker[position.ticker] || []).map(lot => {
      const holdingTerm = getLotTerm(lot.acquiredDate, asOfDate);
      const longTermDate = lot.acquiredDate ? addDays(lot.acquiredDate, 366) : null;
      const marketValue = position.price ? round2(lot.quantity * position.price) : null;
      const unrealizedGainLoss = marketValue !== null && lot.costBasis !== null
        ? round2(marketValue - lot.costBasis)
        : null;
      return {
        ...lot,
        holdingTerm,
        longTermDate,
        marketValue,
        unrealizedGainLoss,
      };
    });
    const earliestAcquiredDate = lots.length
      ? lots.map(lot => lot.acquiredDate).sort()[0]
      : null;
    const shortLots = lots.filter(lot => lot.holdingTerm === 'short');
    const nextLongTermDate = shortLots.length
      ? shortLots.map(lot => lot.longTermDate).sort()[0]
      : null;

    const shortQuantity = round4(lots.filter(lot => lot.holdingTerm === 'short').reduce((sum, lot) => sum + (lot.quantity || 0), 0));
    const longQuantity = round4(lots.filter(lot => lot.holdingTerm === 'long').reduce((sum, lot) => sum + (lot.quantity || 0), 0));
    const shortUnrealizedGainLoss = round2(lots
      .filter(lot => lot.holdingTerm === 'short')
      .reduce((sum, lot) => sum + (lot.unrealizedGainLoss || 0), 0));
    const longUnrealizedGainLoss = round2(lots
      .filter(lot => lot.holdingTerm === 'long')
      .reduce((sum, lot) => sum + (lot.unrealizedGainLoss || 0), 0));

    return {
      ...position,
      acquiredDate: earliestAcquiredDate,
      holdingTerm: aggregateTerm(lots.map(lot => lot.holdingTerm)),
      nextLongTermDate,
      lots,
      lotCount: lots.length,
      shortQuantity,
      longQuantity,
      shortUnrealizedGainLoss,
      longUnrealizedGainLoss,
    };
  });
}

function buildAttentionItems(realizedSales) {
  return realizedSales
    .filter(sale => sale.needsData || sale.needsConfirmation)
    .map(sale => ({
      id: sale.id,
      type: sale.needsData ? 'missing-basis' : 'closed-position-sale',
      severity: sale.needsData ? 'danger' : 'warning',
      ticker: sale.ticker,
      date: sale.date,
      message: sale.needsData
        ? `${sale.ticker} has a sale with unmatched FIFO basis.`
        : `${sale.ticker} left the portfolio and needs tax gain/loss confirmation.`,
      sale,
    }));
}

function buildSummary(state, currentPositions, cash, realizedSales) {
  const carryoverLossEnteringYear = round2(Number(state.carryoverLoss || 0));
  const currentMarketValue = round2(currentPositions.reduce((sum, position) => sum + (position.marketValue || 0), 0));
  const currentCostBasis = round2(currentPositions.reduce((sum, position) => sum + (position.costBasis || 0), 0));
  const currentUnrealizedGainLoss = round2(currentPositions.reduce((sum, position) => sum + (position.unrealizedGainLoss || 0), 0));
  const realizedKnown = realizedSales.filter(sale => !sale.needsData);
  const realizedProceeds = round2(realizedKnown.reduce((sum, sale) => sum + (sale.proceeds || 0), 0));
  const realizedCostBasis = round2(realizedKnown.reduce((sum, sale) => sum + (sale.costBasis || 0), 0));
  const realizedGainLossEstimate = round2(realizedKnown.reduce((sum, sale) => sum + (sale.gainLossEstimate || 0), 0));
  const confirmedRealizedGainLoss = round2(realizedSales.reduce((sum, sale) => sum + (sale.confirmedGainLoss || 0), 0));
  const unconfirmedRealizedGainLoss = round2(realizedSales
    .filter(sale => !sale.confirmed && !sale.needsData)
    .reduce((sum, sale) => sum + (sale.gainLossEstimate || 0), 0));
  const currentTermBreakdown = currentPositions.reduce((breakdown, position) => {
    (position.lots || []).forEach(lot => {
      const key = lot.holdingTerm === 'long' ? 'longTerm' : lot.holdingTerm === 'short' ? 'shortTerm' : 'unknownTerm';
      breakdown[key].marketValue += lot.marketValue || 0;
      breakdown[key].costBasis += lot.costBasis || 0;
      breakdown[key].unrealizedGainLoss += lot.unrealizedGainLoss || 0;
    });
    return breakdown;
  }, {
    shortTerm: { marketValue: 0, costBasis: 0, unrealizedGainLoss: 0 },
    longTerm: { marketValue: 0, costBasis: 0, unrealizedGainLoss: 0 },
    unknownTerm: { marketValue: 0, costBasis: 0, unrealizedGainLoss: 0 },
  });
  Object.values(currentTermBreakdown).forEach(bucket => {
    bucket.marketValue = round2(bucket.marketValue);
    bucket.costBasis = round2(bucket.costBasis);
    bucket.unrealizedGainLoss = round2(bucket.unrealizedGainLoss);
  });

  const realizedTermBreakdown = realizedSales.reduce((breakdown, sale) => {
    if (sale.needsData) return breakdown;
    const key = sale.holdingTerm === 'long' ? 'longTerm' : sale.holdingTerm === 'short' ? 'shortTerm' : 'mixedTerm';
    breakdown[key].proceeds += sale.proceeds || 0;
    breakdown[key].costBasis += sale.costBasis || 0;
    breakdown[key].gainLossEstimate += sale.gainLossEstimate || 0;
    return breakdown;
  }, {
    shortTerm: { proceeds: 0, costBasis: 0, gainLossEstimate: 0 },
    longTerm: { proceeds: 0, costBasis: 0, gainLossEstimate: 0 },
    mixedTerm: { proceeds: 0, costBasis: 0, gainLossEstimate: 0 },
  });
  Object.values(realizedTermBreakdown).forEach(bucket => {
    bucket.proceeds = round2(bucket.proceeds);
    bucket.costBasis = round2(bucket.costBasis);
    bucket.gainLossEstimate = round2(bucket.gainLossEstimate);
  });

  return {
    carryoverLossEnteringYear,
    cash: cash ? cash.marketValue : null,
    currentMarketValue,
    currentCostBasis,
    currentUnrealizedGainLoss,
    currentUnrealizedGainLossPct: currentCostBasis ? round2((currentUnrealizedGainLoss / currentCostBasis) * 100) : null,
    realizedProceeds,
    realizedCostBasis,
    realizedGainLossEstimate,
    confirmedRealizedGainLoss,
    unconfirmedRealizedGainLoss,
    netCapitalResultEstimate: round2(realizedGainLossEstimate - Math.abs(carryoverLossEnteringYear || 0)),
    currentTermBreakdown,
    realizedTermBreakdown,
  };
}

function sanitizePlannerInputs(planner = {}, taxYear) {
  const filingStatus = usFederalTax.normalizeFilingStatus(planner.filingStatus || 'mfj');
  const taxableOrdinaryIncomeAnnual = round2(Number(planner.taxableOrdinaryIncomeAnnual || 0)) || 0;
  const standardDefault = usFederalTax.getStandardDeduction(taxYear, filingStatus);
  const standardDeduction = planner.standardDeduction !== undefined && planner.standardDeduction !== null && String(planner.standardDeduction).trim() !== ''
    ? round2(Number(planner.standardDeduction))
    : (standardDefault !== null ? standardDefault : 0);
  const plannedRothConversion = round2(Number(planner.plannedRothConversion || 0)) || 0;
  const realizedMode = planner.realizedMode === 'confirmed_only' ? 'confirmed_only' : 'confirmed_or_estimate';

  return {
    filingStatus,
    taxableOrdinaryIncomeAnnual: taxableOrdinaryIncomeAnnual < 0 ? 0 : taxableOrdinaryIncomeAnnual,
    standardDeduction: standardDeduction === null || Number.isNaN(standardDeduction) ? (standardDefault || 0) : Math.max(0, standardDeduction),
    plannedRothConversion: plannedRothConversion < 0 ? 0 : plannedRothConversion,
    realizedMode,
  };
}

function computePlanner({ taxYear, plannerInputs, realizedSales }) {
  const inputs = sanitizePlannerInputs(plannerInputs || {}, taxYear);
  const brackets = usFederalTax.getOrdinaryBrackets(taxYear, inputs.filingStatus);

  const included = (realizedSales || [])
    .filter(sale => sale && !sale.needsData)
    .map(sale => {
      const isConfirmed = !!sale.confirmed;
      const mode = inputs.realizedMode;
      if (mode === 'confirmed_only' && !isConfirmed) return null;
      const amount = isConfirmed
        ? sale.confirmedGainLoss
        : sale.gainLossEstimate;
      if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return null;
      return {
        holdingTerm: sale.holdingTerm,
        gainLoss: round2(Number(amount)),
      };
    })
    .filter(Boolean);

  const netShortTerm = round2(included
    .filter(sale => sale.holdingTerm === 'short')
    .reduce((sum, sale) => sum + (sale.gainLoss || 0), 0)) || 0;
  const netLongTerm = round2(included
    .filter(sale => sale.holdingTerm === 'long')
    .reduce((sum, sale) => sum + (sale.gainLoss || 0), 0)) || 0;
  const netCapital = round2(netShortTerm + netLongTerm) || 0;

  const capLossOffsetUsed = netCapital < 0 ? round2(Math.min(3000, Math.abs(netCapital))) : 0;
  const shortTermAfterNetting = round2(Math.max(0, netShortTerm + Math.min(0, netLongTerm))) || 0;

  const ordinaryIncomeEstimate = round2(inputs.taxableOrdinaryIncomeAnnual - capLossOffsetUsed + shortTermAfterNetting) || 0;
  const headroomNoOrdinaryTax = round2(Math.max(0, inputs.standardDeduction - ordinaryIncomeEstimate)) || 0;

  const taxableOrdinaryBefore = round2(Math.max(0, ordinaryIncomeEstimate - inputs.standardDeduction)) || 0;
  const taxableOrdinaryAfter = round2(Math.max(0, ordinaryIncomeEstimate + inputs.plannedRothConversion - inputs.standardDeduction)) || 0;

  const estimatedTaxBefore = usFederalTax.computeOrdinaryTax(taxableOrdinaryBefore, brackets);
  const estimatedTaxAfter = usFederalTax.computeOrdinaryTax(taxableOrdinaryAfter, brackets);
  const incrementalTax = (estimatedTaxBefore !== null && estimatedTaxAfter !== null)
    ? round2(estimatedTaxAfter - estimatedTaxBefore)
    : null;

  const marginal = usFederalTax.findMarginalBracket(taxableOrdinaryAfter, brackets);
  const headroomToNextBracket = usFederalTax.headroomToNextBracket(taxableOrdinaryAfter, brackets);

  return {
    inputs,
    computed: {
      netShortTerm,
      netLongTerm,
      netCapital,
      capLossOffsetUsed,
      shortTermAfterNetting,
      ordinaryIncomeEstimate,
      headroomNoOrdinaryTax,
      taxableOrdinaryBefore,
      taxableOrdinaryAfter,
      marginalRate: marginal ? marginal.rate : null,
      headroomToNextBracket,
      estimatedTaxBefore,
      estimatedTaxAfter,
      incrementalTax,
    },
  };
}

async function getTaxes() {
  const state = readData();
  const positionsPath = resolveRepoPath(process.env.TAX_POSITIONS_CSV || state.sourceFiles.positionsCsv);
  const pdfPath = resolveRepoPath(process.env.TAX_TRANSACTION_HISTORY_PDF || state.sourceFiles.transactionHistoryPdf);

  const positionsData = _parsePositionsCsv(fs.readFileSync(positionsPath, 'utf-8'));
  const transactionsText = await extractPdfText(pdfPath);
  const transactions = _parseTransactionsText(transactionsText);
  const fifo = _reconstructFifo(transactions, state.taxYear, positionsData.positions);
  const positions = buildPositions(positionsData.positions, fifo.lotsByTicker, positionsData.asOfDate);
  const realizedSales = mergeConfirmations(fifo.realizedSales, state.saleConfirmations);
  const attentionItems = buildAttentionItems(realizedSales);
  const planner = computePlanner({ taxYear: state.taxYear, plannerInputs: state.planner, realizedSales });

  return {
    taxYear: state.taxYear,
    method: state.method,
    sources: {
      positionsCsv: state.sourceFiles.positionsCsv,
      transactionHistoryPdf: state.sourceFiles.transactionHistoryPdf,
      positionsAsOf: positionsData.asOf,
    },
    summary: buildSummary(state, positions, positionsData.cash, realizedSales),
    planner,
    positions,
    realizedSales,
    attentionItems,
  };
}

function updateCarryoverLoss(taxYear, amount) {
  const year = Number(taxYear);
  const parsedAmount = Number(amount);
  if (!year || Number.isNaN(parsedAmount)) return null;

  const data = readData();
  data.carryoverLoss = round2(parsedAmount);
  writeData(data);
  return data;
}

function updateSaleConfirmation(saleId, updates = {}) {
  if (!saleId || typeof saleId !== 'string') return null;

  const data = readData();
  const existing = data.saleConfirmations[saleId] || {};
  const next = {
    confirmed: updates.confirmed === undefined ? !!existing.confirmed : !!updates.confirmed,
    gainLossOverride:
      updates.gainLossOverride === undefined
        ? (existing.gainLossOverride === undefined ? null : existing.gainLossOverride)
        : (updates.gainLossOverride === null || updates.gainLossOverride === '' ? null : round2(Number(updates.gainLossOverride))),
    notes: typeof updates.notes === 'string' ? updates.notes.trim() : (existing.notes || ''),
    updatedAt: new Date().toISOString(),
  };

  if (next.gainLossOverride !== null && Number.isNaN(next.gainLossOverride)) return null;
  data.saleConfirmations[saleId] = next;
  writeData(data);
  return next;
}

function updatePlanner(updates = {}) {
  const data = readData();
  const next = {
    ...data.planner,
    ...updates,
  };

  data.planner = sanitizePlannerInputs(next, data.taxYear);
  writeData(data);
  return data.planner;
}

module.exports = {
  getTaxes,
  updateCarryoverLoss,
  updateSaleConfirmation,
  updatePlanner,
  _parsePositionsCsv,
  _parseTransactionsText,
  _reconstructFifo,
  _computePlanner: computePlanner,
};
