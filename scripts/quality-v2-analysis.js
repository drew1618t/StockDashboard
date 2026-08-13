#!/usr/bin/env node

const dataLoader = require('../server/dataLoader');

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value, decimals = 1) {
  if (!isFiniteNumber(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function fmtPct(value) {
  return isFiniteNumber(value) ? `${round(value, 1).toFixed(1)}%` : 'N/A';
}

function fmtScore(value) {
  return isFiniteNumber(value) ? round(value, 1).toFixed(1) : 'N/A';
}

function signed(value) {
  if (!isFiniteNumber(value)) return 'N/A';
  const rounded = round(value, 1);
  if (rounded === 0) return '0.0';
  return rounded > 0 ? `+${rounded.toFixed(1)}` : rounded.toFixed(1);
}

function interpolate(value, start, end, startScore, endScore) {
  const ratio = (value - start) / (end - start);
  return startScore + ratio * (endScore - startScore);
}

function smoothGrowthScore(growthPct) {
  if (!isFiniteNumber(growthPct)) return null;
  if (growthPct < 35) return 0;
  if (growthPct < 45) return interpolate(growthPct, 35, 45, 10, 13);
  if (growthPct < 55) return interpolate(growthPct, 45, 55, 13, 16);
  if (growthPct < 60) return interpolate(growthPct, 55, 60, 16, 19);
  if (growthPct < 75) return interpolate(growthPct, 60, 75, 19, 22);
  if (growthPct < 100) return interpolate(growthPct, 75, 100, 22, 25);
  return 25;
}

function latestGrowthInputs(company) {
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

  return { yoyPct, qoqPct };
}

function momentumGrowthPct(company) {
  const { yoyPct, qoqPct } = latestGrowthInputs(company);
  if (!isFiniteNumber(yoyPct) || !isFiniteNumber(qoqPct)) return null;

  const qoqCap = yoyPct >= 100 ? 30 : 20;
  const cappedQoqPct = Math.min(qoqPct, qoqCap);
  const annualizedQoq = Math.pow(1 + cappedQoqPct / 100, 4) - 1;
  const yoy = yoyPct / 100;

  return {
    yoyPct,
    qoqPct,
    cappedQoqPct,
    momentumPct: yoy * (1 + (annualizedQoq - yoy)) * 100,
  };
}

function scoreCompany(company) {
  const originalScore = company.qualityScore;
  const breakdown = company.qualityBreakdown || {};
  const oldGrowthScore = breakdown.growth;
  const baseWithoutGrowth = isFiniteNumber(originalScore) && isFiniteNumber(oldGrowthScore)
    ? originalScore - oldGrowthScore
    : null;

  const growth = momentumGrowthPct(company);
  if (!growth || !isFiniteNumber(baseWithoutGrowth)) return null;

  const momentumGrowthScore = smoothGrowthScore(growth.momentumPct);
  const seasonalGrowthScore = smoothGrowthScore(growth.yoyPct);

  return {
    ticker: company.ticker,
    originalScore,
    oldGrowthScore,
    yoyPct: growth.yoyPct,
    qoqPct: growth.qoqPct,
    cappedQoqPct: growth.cappedQoqPct,
    momentumPct: growth.momentumPct,
    momentumGrowthScore,
    seasonalGrowthScore,
    v2MomentumScore: baseWithoutGrowth + momentumGrowthScore,
    v2SeasonalScore: baseWithoutGrowth + seasonalGrowthScore,
  };
}

function main() {
  const rows = dataLoader.loadAll()
    .map(scoreCompany)
    .filter(Boolean)
    .sort((a, b) => b.v2MomentumScore - a.v2MomentumScore);

  console.table(rows.map(row => ({
    Ticker: row.ticker,
    Original: fmtScore(row.originalScore),
    'V2 Momentum': fmtScore(row.v2MomentumScore),
    'Delta': signed(row.v2MomentumScore - row.originalScore),
    'V2 Seasonal': fmtScore(row.v2SeasonalScore),
    'Seasonal Delta': signed(row.v2SeasonalScore - row.originalScore),
    'Old Growth': fmtScore(row.oldGrowthScore),
    'Momentum Growth': fmtPct(row.momentumPct),
    'Momentum Growth Score': fmtScore(row.momentumGrowthScore),
    'YoY Growth': fmtPct(row.yoyPct),
    'Seasonal Growth Score': fmtScore(row.seasonalGrowthScore),
    'QoQ': fmtPct(row.qoqPct),
    'Capped QoQ': fmtPct(row.cappedQoqPct),
  })));
}

main();
