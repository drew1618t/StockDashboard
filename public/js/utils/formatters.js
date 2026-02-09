/**
 * formatters.js — Number, currency, and percentage formatting utilities.
 */
const Fmt = {
  /** Format number with commas: 1234567 → "1,234,567" */
  num(v, decimals = 0) {
    if (v === null || v === undefined || v === 'N/A') return 'N/A';
    return Number(v).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  },

  /** Format as currency: 155.92 → "$155.92" */
  price(v) {
    if (v === null || v === undefined || v === 'N/A') return 'N/A';
    return '$' + Number(v).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  /** Format millions: 2103.29 → "$2.1B" or 164.0 → "$164.0M" */
  millions(v) {
    if (v === null || v === undefined || v === 'N/A') return 'N/A';
    const n = Number(v);
    if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'B';
    if (Math.abs(n) >= 1) return '$' + n.toFixed(1) + 'M';
    if (Math.abs(n) >= 0.001) return '$' + (n * 1000).toFixed(0) + 'K';
    return '$0';
  },

  /** Format as percentage: 63.0 → "63.0%" with optional sign */
  pct(v, showSign = false) {
    if (v === null || v === undefined || v === 'N/A') return 'N/A';
    const n = Number(v);
    const sign = showSign && n > 0 ? '+' : '';
    return sign + n.toFixed(1) + '%';
  },

  /** Format as ratio/multiple: 5.02 → "5.0x" */
  multiple(v) {
    if (v === null || v === undefined || v === 'N/A') return 'N/A';
    return Number(v).toFixed(1) + 'x';
  },

  /** Momentum indicator arrow */
  momentum(trend) {
    if (!trend) return '';
    const icons = {
      accelerating: { symbol: '\u2191', label: 'Accelerating', cls: 'momentum-up' },
      stable: { symbol: '\u2192', label: 'Stable', cls: 'momentum-flat' },
      decelerating: { symbol: '\u2193', label: 'Decelerating', cls: 'momentum-down' },
    };
    const info = icons[trend] || icons.stable;
    return `<span class="${info.cls}" title="${info.label}">${info.symbol} ${info.label}</span>`;
  },

  /** Verdict badge */
  verdict(v) {
    if (!v) return '<span class="verdict verdict-unknown">N/A</span>';
    const cls = {
      PASS: 'verdict-pass', 'STRONG PASS': 'verdict-pass',
      CAUTION: 'verdict-caution', WATCH: 'verdict-caution',
      FAIL: 'verdict-fail', DISQUALIFIED: 'verdict-fail',
    }[v.toUpperCase()] || 'verdict-unknown';
    return `<span class="verdict ${cls}">${v}</span>`;
  },

  /** Saul grade badge */
  saulGrade(grade) {
    if (!grade) return '<span class="saul-grade grade-unknown">N/A</span>';
    const cls = {
      STRONG: 'grade-strong', PASS: 'grade-pass',
      WEAK_PASS: 'grade-weak', FAIL: 'grade-fail',
      INCOMPLETE: 'grade-unknown',
    }[grade] || 'grade-unknown';
    return `<span class="saul-grade ${cls}">${grade}</span>`;
  },

  /** Format delta with color class */
  delta(v) {
    if (v === null || v === undefined) return 'N/A';
    const n = Number(v);
    const sign = n > 0 ? '+' : '';
    const cls = n > 0 ? 'delta-positive' : n < 0 ? 'delta-negative' : 'delta-neutral';
    return `<span class="${cls}">${sign}${n.toFixed(1)}</span>`;
  },
};

// Make globally available
window.Fmt = Fmt;
