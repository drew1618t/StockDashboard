const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const taxStore = require('../server/taxStore');

const POSITIONS_PATH = path.join(__dirname, '..', 'data', 'Drew Individual-Positions-2026-04-13-083744.csv');
const TRANSACTIONS_PATH = path.join(__dirname, '..', 'data', 'Transaction History _ Charles Schwab.pdf');
const HAS_SOURCE_FILES = fs.existsSync(POSITIONS_PATH) && fs.existsSync(TRANSACTIONS_PATH);
const SOURCE_FILE_SKIP = HAS_SOURCE_FILES ? false : 'Schwab tax source files are not present in this checkout';

async function extractTransactionText() {
  const parser = new PDFParse({ data: fs.readFileSync(TRANSACTIONS_PATH) });
  try {
    const result = await parser.getText({ pageJoiner: '\n--- TAX PAGE page_number ---\n' });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function assertClose(actual, expected, tolerance = 0.01) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test('parses Schwab positions CSV and computes current equity totals', { skip: SOURCE_FILE_SKIP }, () => {
  const parsed = taxStore._parsePositionsCsv(fs.readFileSync(POSITIONS_PATH, 'utf-8'));

  assert.equal(parsed.positions.length, 8);
  assert.deepEqual(parsed.positions.map(position => position.ticker), [
    'ALAB', 'APP', 'ELVA', 'FIGR', 'IREN', 'MU', 'PTRN', 'SEI',
  ]);
  assert.equal(parsed.cash.marketValue, 59967.06);
  assertClose(parsed.totals.equityMarketValue, 182681.21);
  assertClose(parsed.totals.equityCostBasis, 113315.69);
  assertClose(parsed.totals.equityUnrealizedGainLoss, 69365.52);
  assert.equal(parsed.positions.find(position => position.ticker === 'IREN').quantity, 1288);
  assert.equal(parsed.positions.find(position => position.ticker === 'FIGR').unrealizedGainLoss, -4347.09);
});

test('parses equity buys and sells from Schwab transaction history text', { skip: SOURCE_FILE_SKIP }, async () => {
  const transactions = taxStore._parseTransactionsText(await extractTransactionText());
  const buys2026 = transactions.filter(tx => tx.type === 'buy' && tx.date.startsWith('2026-'));
  const sells2026 = transactions.filter(tx => tx.type === 'sell' && tx.date.startsWith('2026-'));

  assert.ok(buys2026.some(tx => tx.ticker === 'PTRN' && tx.quantity === 311));
  assert.ok(sells2026.some(tx => tx.ticker === 'DAVE' && tx.quantity === 61));
  assert.ok(sells2026.some(tx => tx.ticker === 'CRMD' && tx.quantity === 4333));
  assert.equal(transactions.some(tx => tx.type === 'sell to close'), false);
  assert.equal(transactions.some(tx => tx.ticker === 'SCHWAB1'), false);
});

test('reconstructs FIFO open lots for current positions', { skip: SOURCE_FILE_SKIP }, async () => {
  const positions = taxStore._parsePositionsCsv(fs.readFileSync(POSITIONS_PATH, 'utf-8')).positions;
  const transactions = taxStore._parseTransactionsText(await extractTransactionText());
  const fifo = taxStore._reconstructFifo(transactions, 2026, positions);

  assert.deepEqual(fifo.lotsByTicker.ALAB.map(lot => [lot.acquiredDate, lot.quantity]), [
    ['2024-11-08', 142],
    ['2024-11-22', 23],
    ['2025-03-21', 49],
  ]);
  assert.equal(fifo.lotsByTicker.APP[0].acquiredDate, '2024-06-24');
  assert.equal(fifo.lotsByTicker.APP[0].quantity, 76);
  assert.equal(fifo.lotsByTicker.IREN[0].acquiredDate, '2025-08-11');
  assert.equal(fifo.lotsByTicker.IREN[0].quantity, 1288);
  assert.equal(fifo.lotsByTicker.MU[0].acquiredDate, '2026-01-14');
  assert.equal(fifo.lotsByTicker.MU[0].quantity, 60);

  assertClose(fifo.lotsByTicker.ALAB.reduce((sum, lot) => sum + lot.costBasis, 0), 19282.21, 0.02);
  assertClose(fifo.lotsByTicker.IREN[0].costBasis, 23245.96);
});

test('computes 2026 realized FIFO estimates from closed positions', { skip: SOURCE_FILE_SKIP }, async () => {
  const positions = taxStore._parsePositionsCsv(fs.readFileSync(POSITIONS_PATH, 'utf-8')).positions;
  const transactions = taxStore._parseTransactionsText(await extractTransactionText());
  const fifo = taxStore._reconstructFifo(transactions, 2026, positions);
  const byTicker = Object.fromEntries(fifo.realizedSales.map(sale => [sale.ticker, sale]));

  assertClose(byTicker.DAVE.gainLossEstimate, -463.00);
  assertClose(byTicker.OGI.gainLossEstimate, -2188.80);
  assertClose(byTicker.BHST.gainLossEstimate, -5847.52);
  assertClose(byTicker.HIVE.gainLossEstimate, -6377.55);
  assertClose(byTicker.RDDT.gainLossEstimate, 5283.00);
  assertClose(byTicker.CRMD.gainLossEstimate, -20987.46);
  assert.equal(byTicker.RDDT.holdingTerm, 'long');
  assert.equal(byTicker.CRMD.holdingTerm, 'short');
  assert.equal(Object.values(byTicker).every(sale => sale.closedPosition), true);

  const total = fifo.realizedSales.reduce((sum, sale) => sum + sale.gainLossEstimate, 0);
  assertClose(total, -30581.33);
});

test('flags a synthetic sale with no prior basis as needing data', () => {
  const fifo = taxStore._reconstructFifo([
    {
      originalIndex: 1,
      date: '2026-01-02',
      type: 'sell',
      ticker: 'MISS',
      description: 'MISSING BASIS INC',
      quantity: 10,
      price: 10,
      proceeds: 100,
    },
  ], 2026, []);

  assert.equal(fifo.realizedSales.length, 1);
  assert.equal(fifo.realizedSales[0].needsData, true);
  assert.equal(fifo.realizedSales[0].closedPosition, true);
});

test('persists sale confirmation overrides without changing FIFO estimate', { skip: SOURCE_FILE_SKIP }, async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tax-store-'));
  const tempStatePath = path.join(tempDir, 'taxes.json');
  const previousPath = process.env.TAXES_STATE_PATH;

  fs.writeFileSync(tempStatePath, JSON.stringify({
    method: 'fifo',
    account: { label: 'Drew Individual', mask: '893' },
    sourceFiles: {
      positionsCsv: 'data/Drew Individual-Positions-2026-04-13-083744.csv',
      transactionHistoryPdf: 'data/Transaction History _ Charles Schwab.pdf',
    },
    carryoverLoss: 0,
    lastFiledTaxYear: 2025,
    saleConfirmations: {},
  }, null, 2));

  try {
    process.env.TAXES_STATE_PATH = tempStatePath;
    const before = await taxStore.getTaxes();
    const rddt = before.realizedSales.find(sale => sale.ticker === 'RDDT');
    assert.equal(rddt.gainLossEstimate, 5283);

    const confirmation = taxStore.updateSaleConfirmation(rddt.id, {
      confirmed: true,
      gainLossOverride: 1234.56,
      notes: 'Matched Schwab realized gain/loss report',
    });
    assert.equal(confirmation.confirmed, true);
    assert.equal(confirmation.gainLossOverride, 1234.56);

    const after = await taxStore.getTaxes();
    const confirmed = after.realizedSales.find(sale => sale.ticker === 'RDDT');
    assert.equal(confirmed.gainLossEstimate, 5283);
    assert.equal(confirmed.confirmedGainLoss, 1234.56);
    assert.equal(after.summary.confirmedRealizedGainLoss, 1234.56);
  } finally {
    if (previousPath === undefined) delete process.env.TAXES_STATE_PATH;
    else process.env.TAXES_STATE_PATH = previousPath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('planner computes MFJ headroom at standard deduction', () => {
  const result = taxStore._computePlanner({
    taxYear: 2026,
    plannerInputs: {
      filingStatus: 'mfj',
      taxableOrdinaryIncomeAnnual: 9908.04,
      standardDeduction: 32200,
      plannedRothConversion: 0,
      realizedMode: 'confirmed_or_estimate',
    },
    realizedSales: [],
  });

  assertClose(result.computed.headroomNoOrdinaryTax, 22291.96);
  assertClose(result.computed.ordinaryIncomeEstimate, 9908.04);
  assertClose(result.computed.taxableOrdinaryBefore, 0);
});

test('planner reduces headroom with short-term gains', () => {
  const result = taxStore._computePlanner({
    taxYear: 2026,
    plannerInputs: {
      filingStatus: 'mfj',
      taxableOrdinaryIncomeAnnual: 9908.04,
      standardDeduction: 32200,
      plannedRothConversion: 0,
      realizedMode: 'confirmed_or_estimate',
    },
    realizedSales: [
      {
        needsData: false,
        confirmed: false,
        gainLossEstimate: 5000,
        holdingTerm: 'short',
      },
    ],
  });

  assertClose(result.computed.headroomNoOrdinaryTax, 17291.96);
  assertClose(result.computed.shortTermAfterNetting, 5000);
});

test('planner caps ordinary offset from net capital loss at $3,000', () => {
  const result = taxStore._computePlanner({
    taxYear: 2026,
    plannerInputs: {
      filingStatus: 'mfj',
      taxableOrdinaryIncomeAnnual: 9908.04,
      standardDeduction: 32200,
      plannedRothConversion: 0,
      useCapitalLossOffset: true,
      realizedMode: 'confirmed_or_estimate',
    },
    realizedSales: [
      {
        needsData: false,
        confirmed: false,
        gainLossEstimate: -30581.33,
        holdingTerm: 'short',
      },
    ],
  });

  assertClose(result.computed.capLossOffsetUsed, 3000);
  assertClose(result.computed.ordinaryIncomeEstimate, 6908.04);
});

test('planner can ignore the ordinary offset from net capital loss', () => {
  const result = taxStore._computePlanner({
    taxYear: 2026,
    plannerInputs: {
      filingStatus: 'mfj',
      taxableOrdinaryIncomeAnnual: 9908.04,
      standardDeduction: 32200,
      plannedRothConversion: 0,
      useCapitalLossOffset: false,
      realizedMode: 'confirmed_or_estimate',
    },
    realizedSales: [
      {
        needsData: false,
        confirmed: false,
        gainLossEstimate: -30581.33,
        holdingTerm: 'short',
      },
    ],
  });

  assertClose(result.computed.capLossOffsetUsed, 0);
  assertClose(result.computed.ordinaryIncomeEstimate, 9908.04);
});

test('planner bracket math responds to MFJ threshold boundaries', () => {
  const zero = taxStore._computePlanner({
    taxYear: 2026,
    plannerInputs: {
      filingStatus: 'mfj',
      taxableOrdinaryIncomeAnnual: 32200,
      standardDeduction: 32200,
      plannedRothConversion: 24800,
      useCapitalLossOffset: true,
      realizedMode: 'confirmed_or_estimate',
    },
    realizedSales: [],
  });
  assertClose(zero.computed.taxableOrdinaryAfter, 24800);
  assert.equal(zero.computed.marginalRate, 0.10);

  const next = taxStore._computePlanner({
    taxYear: 2026,
    plannerInputs: {
      filingStatus: 'mfj',
      taxableOrdinaryIncomeAnnual: 32200,
      standardDeduction: 32200,
      plannedRothConversion: 24801,
      useCapitalLossOffset: true,
      realizedMode: 'confirmed_or_estimate',
    },
    realizedSales: [],
  });
  assertClose(next.computed.taxableOrdinaryAfter, 24801);
  assert.equal(next.computed.marginalRate, 0.12);
});
