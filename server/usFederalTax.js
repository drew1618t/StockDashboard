function round2(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function clampNonNeg(n) {
  const v = Number(n);
  if (Number.isNaN(v) || v < 0) return 0;
  return v;
}

// 2026 standard deduction amounts (IRS Form 1040-ES for 2026).
const STANDARD_DEDUCTION_2026 = {
  mfj: 32200,
  qss: 32200,
  hoh: 24150,
  single: 16100,
  mfs: 16100,
};

// 2026 ordinary income bracket thresholds (taxable income) from Rev. Proc. 2025-32.
// Brackets are represented as sequential [start, end] ranges where end is inclusive.
const ORDINARY_BRACKETS_2026 = {
  // Married filing jointly / qualifying surviving spouse
  mfj: [
    { start: 0, end: 24800, rate: 0.10 },
    { start: 24800, end: 100800, rate: 0.12 },
    { start: 100800, end: 211400, rate: 0.22 },
    { start: 211400, end: 403550, rate: 0.24 },
    { start: 403550, end: 512450, rate: 0.32 },
    { start: 512450, end: 768700, rate: 0.35 },
    { start: 768700, end: null, rate: 0.37 },
  ],
  qss: [
    { start: 0, end: 24800, rate: 0.10 },
    { start: 24800, end: 100800, rate: 0.12 },
    { start: 100800, end: 211400, rate: 0.22 },
    { start: 211400, end: 403550, rate: 0.24 },
    { start: 403550, end: 512450, rate: 0.32 },
    { start: 512450, end: 768700, rate: 0.35 },
    { start: 768700, end: null, rate: 0.37 },
  ],
  // Head of household
  hoh: [
    { start: 0, end: 17700, rate: 0.10 },
    { start: 17700, end: 67450, rate: 0.12 },
    { start: 67450, end: 105700, rate: 0.22 },
    { start: 105700, end: 201750, rate: 0.24 },
    { start: 201750, end: 256200, rate: 0.32 },
    { start: 256200, end: 640600, rate: 0.35 },
    { start: 640600, end: null, rate: 0.37 },
  ],
  // Single
  single: [
    { start: 0, end: 12400, rate: 0.10 },
    { start: 12400, end: 50400, rate: 0.12 },
    { start: 50400, end: 105700, rate: 0.22 },
    { start: 105700, end: 201775, rate: 0.24 },
    { start: 201775, end: 256225, rate: 0.32 },
    { start: 256225, end: 640600, rate: 0.35 },
    { start: 640600, end: null, rate: 0.37 },
  ],
  // Married filing separately
  mfs: [
    { start: 0, end: 12400, rate: 0.10 },
    { start: 12400, end: 50400, rate: 0.12 },
    { start: 50400, end: 105700, rate: 0.22 },
    { start: 105700, end: 201775, rate: 0.24 },
    { start: 201775, end: 256225, rate: 0.32 },
    { start: 256225, end: 384350, rate: 0.35 },
    { start: 384350, end: null, rate: 0.37 },
  ],
};

function normalizeFilingStatus(status) {
  const raw = String(status || '').toLowerCase();
  if (raw === 'mfj' || raw === 'joint' || raw === 'married_filing_jointly') return 'mfj';
  if (raw === 'single') return 'single';
  if (raw === 'hoh' || raw === 'head_of_household') return 'hoh';
  if (raw === 'mfs' || raw === 'married_filing_separately') return 'mfs';
  if (raw === 'qss' || raw === 'widow' || raw === 'qualifying_surviving_spouse') return 'qss';
  return 'mfj';
}

function getStandardDeduction(taxYear, filingStatus) {
  const year = Number(taxYear);
  const status = normalizeFilingStatus(filingStatus);
  if (year === 2026) return STANDARD_DEDUCTION_2026[status] ?? STANDARD_DEDUCTION_2026.mfj;
  // v1 only has authoritative values for 2026; allow UI override via planner.standardDeduction.
  return null;
}

function getOrdinaryBrackets(taxYear, filingStatus) {
  const year = Number(taxYear);
  const status = normalizeFilingStatus(filingStatus);
  if (year === 2026) return ORDINARY_BRACKETS_2026[status] ?? ORDINARY_BRACKETS_2026.mfj;
  return null;
}

function computeOrdinaryTax(taxableIncome, brackets) {
  const income = clampNonNeg(taxableIncome);
  const b = Array.isArray(brackets) ? brackets : null;
  if (!b || b.length === 0) return null;

  let tax = 0;
  for (let i = 0; i < b.length; i += 1) {
    const { start, end, rate } = b[i];
    const bracketStart = Math.max(0, Number(start || 0));
    const bracketEnd = end === null || end === undefined ? null : Number(end);
    const nextStart = i + 1 < b.length ? Math.max(0, Number(b[i + 1].start || 0)) : null;

    if (income <= bracketStart) break;

    const upperExclusive = bracketEnd === null
      ? income
      : Math.min(income, bracketEnd);
    const lowerInclusive = bracketStart;

    // Each bracket is defined by start (previous threshold) and end (current threshold, inclusive).
    // The width is effectively [start, end], and the next bracket starts at end.
    const width = upperExclusive - lowerInclusive;
    if (width <= 0) continue;

    tax += width * Number(rate || 0);

    if (bracketEnd !== null && income <= bracketEnd) break;

    // Guard against malformed bracket tables where start values do not advance.
    if (nextStart !== null && nextStart <= bracketStart) break;
  }

  return round2(tax);
}

function findMarginalBracket(taxableIncome, brackets) {
  const income = clampNonNeg(taxableIncome);
  const b = Array.isArray(brackets) ? brackets : null;
  if (!b || b.length === 0) return null;

  // Boundaries: income exactly at end threshold is still in that bracket.
  for (let i = 0; i < b.length; i += 1) {
    const { start, end, rate } = b[i];
    const bracketStart = Math.max(0, Number(start || 0));
    const bracketEnd = end === null || end === undefined ? null : Number(end);
    if (bracketEnd === null) {
      return { index: i, start: bracketStart, end: null, rate: Number(rate || 0) };
    }
    if (income <= bracketEnd) {
      return { index: i, start: bracketStart, end: bracketEnd, rate: Number(rate || 0) };
    }
  }

  const last = b[b.length - 1];
  return { index: b.length - 1, start: Number(last.start || 0), end: last.end ?? null, rate: Number(last.rate || 0) };
}

function headroomToNextBracket(taxableIncome, brackets) {
  const bracket = findMarginalBracket(taxableIncome, brackets);
  if (!bracket) return null;
  if (bracket.end === null) return null;
  const income = clampNonNeg(taxableIncome);
  return round2(Math.max(0, bracket.end - income));
}

module.exports = {
  normalizeFilingStatus,
  getStandardDeduction,
  getOrdinaryBrackets,
  computeOrdinaryTax,
  findMarginalBracket,
  headroomToNextBracket,
};

