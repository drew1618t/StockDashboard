#!/usr/bin/env node

const dataLoader = require('../server/dataLoader');

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function pct(value) {
  return isFiniteNumber(value) ? `${value.toFixed(1)}%` : 'N/A';
}

const CAP_VARIANTS = {
  tiered_25_35: yoyPct => yoyPct >= 100 ? 35 : 25,
  single_25: () => 25,
  tiered_20_30: yoyPct => yoyPct >= 100 ? 30 : 20,
  single_20: () => 20,
};

function capQoq(qoqPct, yoyPct, capFn) {
  return Math.min(qoqPct, capFn(yoyPct));
}

function signedRankDelta(value) {
  if (!isFiniteNumber(value) || value === 0) return '0';
  return value > 0 ? `+${value}` : `${value}`;
}

function growthScoreFromPct(growthPct) {
  if (!isFiniteNumber(growthPct)) return null;
  if (growthPct < 35) return 0;
  if (growthPct < 45) return 10;
  if (growthPct < 55) return 13;
  if (growthPct < 60) return 16;
  if (growthPct < 75) return 19;
  if (growthPct < 100) return 22;
  return 25;
}

function rankBy(rows, key, descending = true) {
  return [...rows]
    .filter(row => isFiniteNumber(row[key]))
    .sort((a, b) => descending ? b[key] - a[key] : a[key] - b[key])
    .reduce((ranked, row, index) => {
      ranked[row.ticker] = index + 1;
      return ranked;
    }, {});
}

function latestRevenueMomentum(company) {
  const hist = company.quarterlyHistory || [];
  const current = hist[0];
  const prior = hist[1];
  const yearAgo = hist[4];

  let yoyPct = current?.revenueYoyPct ?? company.revenueYoyPct;
  if (!isFiniteNumber(yoyPct) && current?.revenueMil && yearAgo?.revenueMil) {
    yoyPct = ((current.revenueMil / yearAgo.revenueMil) - 1) * 100;
  }

  let qoqPct = current?.revenueQoqPct ?? company.revenueQoqPct;
  if (!isFiniteNumber(qoqPct) && current?.revenueMil && prior?.revenueMil) {
    qoqPct = ((current.revenueMil / prior.revenueMil) - 1) * 100;
  }

  if (!isFiniteNumber(yoyPct) || !isFiniteNumber(qoqPct)) return null;

  const yoy = yoyPct / 100;
  const qoq = qoqPct / 100;
  const annualizedQoq = Math.pow(1 + qoq, 4) - 1;
  const momentum = yoy * (1 + (annualizedQoq - yoy));

  const variants = {};
  Object.entries(CAP_VARIANTS).forEach(([name, capFn]) => {
    const cappedQoqPct = capQoq(qoqPct, yoyPct, capFn);
    const cappedQoq = cappedQoqPct / 100;
    const cappedAnnualizedQoq = Math.pow(1 + cappedQoq, 4) - 1;
    const cappedMomentum = yoy * (1 + (cappedAnnualizedQoq - yoy));
    variants[name] = {
      qoqPct: cappedQoqPct,
      annualizedQoqPct: cappedAnnualizedQoq * 100,
      accelGapPct: (cappedAnnualizedQoq - yoy) * 100,
      momentumPct: cappedMomentum * 100,
    };
  });

  return {
    ticker: company.ticker,
    qualityScore: company.qualityScore,
    currentGrowthScore: company.qualityBreakdown?.growth ?? null,
    latestQuarter: current?.quarter || company.revenueRecentLabel || '',
    yoyPct,
    qoqPct,
    annualizedQoqPct: annualizedQoq * 100,
    accelGapPct: (annualizedQoq - yoy) * 100,
    draftMomentumPct: momentum * 100,
    seasonalNeutralMomentumPct: yoyPct,
    seasonalNeutralGrowthScore: growthScoreFromPct(yoyPct),
    variants,
  };
}

function main() {
  const scope = (process.argv[2] || 'portfolio').toLowerCase();
  const portfolio = dataLoader.loadAll();

  let companies = portfolio;
  if (scope === 'all') {
    const available = dataLoader.getAvailableTickers().available.map(({ ticker }) => {
      return dataLoader.getCompany(ticker).company;
    }).filter(Boolean);
    companies = [...portfolio, ...available];
  }

  const rows = companies
    .map(latestRevenueMomentum)
    .filter(Boolean);

  const yoyRanks = rankBy(rows, 'yoyPct');
  const momentumRanks = rankBy(rows, 'draftMomentumPct');
  const comparisonVariant = 'tiered_20_30';
  const comparisonRows = rows.map(row => ({
    ...row,
    comparisonMomentumPct: row.variants[comparisonVariant].momentumPct,
  }));
  const cappedMomentumRanks = rankBy(comparisonRows, 'comparisonMomentumPct');

  const output = rows
    .map(row => ({
      ...row,
      yoyRank: yoyRanks[row.ticker],
      momentumRank: momentumRanks[row.ticker],
      cappedMomentumRank: cappedMomentumRanks[row.ticker],
      rankChange: yoyRanks[row.ticker] - momentumRanks[row.ticker],
      cappedRankChange: yoyRanks[row.ticker] - cappedMomentumRanks[row.ticker],
    }))
    .sort((a, b) => b.variants[comparisonVariant].momentumPct - a.variants[comparisonVariant].momentumPct);

  console.table(output.map(row => ({
    Ticker: row.ticker,
    Quality: row.qualityScore ?? 'N/A',
    'Growth Score': row.currentGrowthScore ?? 'N/A',
    Latest: row.latestQuarter,
    YoY: pct(row.yoyPct),
    QoQ: pct(row.qoqPct),
    'Draft Momentum': pct(row.draftMomentumPct),
    '25/35 Cap': pct(row.variants.tiered_25_35.momentumPct),
    '25 Cap': pct(row.variants.single_25.momentumPct),
    '20/30 Cap': pct(row.variants.tiered_20_30.momentumPct),
    'Seasonal Neutral': pct(row.seasonalNeutralMomentumPct),
    '20/30 Growth Score': growthScoreFromPct(row.variants.tiered_20_30.momentumPct),
    'Seasonal Growth Score': row.seasonalNeutralGrowthScore,
    '20 Cap': pct(row.variants.single_20.momentumPct),
    '20/30 Rank vs YoY': signedRankDelta(row.cappedRankChange),
  })));
}

main();
