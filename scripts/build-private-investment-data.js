const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const trackerInspectionPath = path.join(
  repoRoot,
  'outputs',
  'account-tracker-2026-07-28',
  'four_account_portfolio_tracker.xlsx.inspect.ndjson'
);
const studyInspectionPath = path.join(
  repoRoot,
  'outputs',
  'investment-success-2026-07-28',
  'investment_success_first_buy_to_peak.xlsx.inspect.ndjson'
);
const studyAnalysisPath = path.join(
  repoRoot,
  '.work',
  'investment-success-20260728',
  'analysis.json'
);
const studySummaryPath = path.join(
  repoRoot,
  '.work',
  'investment-success-20260728',
  'inspect-summary.json'
);
const outputDir = path.join(repoRoot, 'data', 'private-investments');

function readInspectedTable(filePath, sheetName) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    const record = JSON.parse(line);
    if (record.kind === 'table' && record.sheet === sheetName) return record.values;
  }
  throw new Error(`Inspected table not found: ${sheetName}`);
}

function readWorkbookSheets(filePath) {
  const sheets = [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    const record = JSON.parse(line);
    if (record.kind !== 'table') continue;
    sheets.push({
      name: record.sheet,
      address: record.address,
      rowCount: record.rows || record.values.length,
      columnCount: record.cols || record.values[0]?.length || 0,
      values: record.values,
    });
  }
  if (!sheets.length) throw new Error(`No workbook sheets found in ${filePath}`);
  return { sheets };
}

function mapRows(headers, rows) {
  return rows.map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

function buildTrackerSnapshot() {
  const rows = readInspectedTable(trackerInspectionPath, 'Dashboard');
  const accountHeaders = [
    'account',
    'equityValue',
    'moneyMarket',
    'otherCash',
    'totalCash',
    'activePositions',
    'transactions',
    'income',
    'dataIssues',
  ];
  const holdingHeaders = [
    'ticker',
    'drewIndividualShares',
    'drewRothShares',
    'kailiRothShares',
    'traditionalIraShares',
    'totalShares',
    'price',
    'currentValue',
    'weight',
    'grossCost',
    'sales',
    'income',
    'estimatedLifetimeProfitLoss',
    'returnOnCost',
  ];

  return {
    asOf: '2026-07-28',
    title: rows[0][0],
    description: rows[2][0],
    summary: {
      totalPortfolio: rows[5][0],
      equityValue: rows[5][2],
      cashEquivalents: rows[5][4],
      transactions: rows[5][6],
      activeHoldings: rows[5][8],
      modelStatus: rows[5][10],
    },
    accounts: mapRows(accountHeaders, rows.slice(10, 14)),
    holdings: mapRows(holdingHeaders, rows.slice(19, 31)),
    note: rows[32][0],
    workbook: readWorkbookSheets(trackerInspectionPath),
  };
}

function buildStudySnapshot() {
  const analysis = JSON.parse(fs.readFileSync(studyAnalysisPath, 'utf8'));
  const inspected = JSON.parse(fs.readFileSync(studySummaryPath, 'utf8'));
  const summaryTable = JSON.parse(inspected.ndjson).values;

  const patterns = summaryTable.slice(10, 15).map(row => ({
    number: row[0],
    title: row[1],
    evidence: row[4],
  }));

  return {
    asOf: analysis.asOf,
    title: 'Investment Success Study — First Buy to Peak',
    description: 'Complete purchase episodes across four accounts using split-adjusted market prices.',
    counts: analysis.counts,
    patterns,
    topEpisodes: analysis.episodes.slice(0, 10).map(episode => ({
      rank: episode.rank,
      account: episode.account,
      ticker: episode.ticker,
      firstBuyDate: episode.firstBuyDate,
      peakDate: episode.peakDate,
      peakReturn: episode.peakReturn,
      exitOrCurrentReturn: episode.exitOrCurrentReturn,
      peakToEndDrawdown: episode.peakToEndDrawdown,
    })),
    topTickers: [...analysis.tickerRollup]
      .sort((a, b) => b.medianPeakReturn - a.medianPeakReturn)
      .slice(0, 10)
      .map((ticker, index) => ({
        rank: index + 1,
        ticker: ticker.ticker,
        theme: ticker.theme,
        episodes: ticker.eligibleEpisodes,
        medianPeakReturn: ticker.medianPeakReturn,
        bestPeakReturn: ticker.bestPeakReturn,
        medianDaysToPeak: ticker.medianDaysToPeak,
        medianPeakGiveback: ticker.medianPeakToEndDrawdown,
      })),
    limitations: [
      `${analysis.counts.excludedIncomplete} visible histories lacked their original purchase and were excluded.`,
      'The study measures price return from first buy to peak, not total return or internal rate of return.',
      'The portfolio reflects one selection process; survivorship, hindsight, and repeated-account effects remain possible.',
    ],
    workbook: readWorkbookSheets(studyInspectionPath),
  };
}

function writeSnapshot(fileName, data) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, fileName), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

writeSnapshot('tracker.json', buildTrackerSnapshot());
writeSnapshot('study.json', buildStudySnapshot());
console.log(`[private-investments] wrote tracker.json and study.json to ${outputDir}`);
