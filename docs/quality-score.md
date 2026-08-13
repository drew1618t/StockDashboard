# Quality Score Formula

The Quality Score is a 0-100 ranking score used to compare companies that already pass the broader investment screen. It is not the same thing as the Saul rules score or the conviction score.

In the dashboard, the Summary page reads the explicit `qualityScore` field that is normalized from:

```json
evaluation.quality_score
```

If that field is missing from a company's `*_dashboard_metrics.json`, the dashboard shows `N/A`. It does not fall back to `saulSummary.score`.

## Purpose

Conviction is the gate: it answers whether the company passes the investment rules.

Quality is the ranker: it differentiates passing or watchlist companies by growth magnitude, valuation, margins, profitability, dilution, and rule alignment.

## Total Score

```text
Quality Score =
  Valuation
+ Growth
+ Margins and Operating Leverage
+ Profitability Quality
+ Share Count Discipline
+ Saul Rule Alignment
```

The practical range is usually near 0-100, but one component can be negative, so very weak companies can score below zero before any presentation-level clamping.

## Component Weights

| Component | Range | What It Rewards |
|---|---:|---|
| Valuation | 0 to 15 | Low run-rate P/E relative to revenue growth |
| Growth | 0 to 25 | Strong YoY revenue growth, with acceleration adjustment for mid-growth companies |
| Margins and Operating Leverage | 0 to 20 | EBITDA margin expansion and high incremental margins |
| Profitability Quality | -2 to 15 | High EBITDA margin and free cash flow margin |
| Share Count Discipline | -10 to +10 | Low dilution or shrinking share count |
| Saul Rule Alignment | 0 to 15 | Clean pass profile across Saul rule tiers |

## Valuation: 0 to 15

Valuation uses growth-adjusted run-rate P/E:

```text
valuation_ratio = run_rate_pe / revenue_yoy_pct
```

Lower is better.

| Ratio | Score |
|---:|---:|
| `< 0.3` | 15 |
| `< 0.6` | 12 |
| `< 1.0` | 9 |
| `< 1.5` | 5 |
| `< 2.0` | 2 |
| `>= 2.0` | 0 |
| Missing P/E or non-positive growth | 7 |

## Growth: 0 to 25

Growth starts with the latest revenue YoY percentage.

| Revenue YoY | Base Score |
|---:|---:|
| `< 35%` | 0 |
| `35% to <45%` | 10 |
| `45% to <55%` | 13 |
| `55% to <60%` | 16 |
| `60% to <75%` | 19 |
| `75% to <100%` | 22 |
| `>= 100%` | 25 |

For companies growing between 35% and 60%, the formula also checks acceleration using the latest two quarters of QoQ growth:

```text
avg_qoq = average(latest_qoq, prior_qoq)
implied_annual_growth = ((1 + avg_qoq / 100) ^ 4 - 1) * 100
diff = implied_annual_growth - latest_yoy
```

Acceleration adjustment:

| YoY Band | Max Adjustment |
|---:|---:|
| `35% to <45%` | +/-5 |
| `45% to <55%` | +/-3 |
| `55% to <60%` | +/-1 |

If `diff > 5`, the company gets the positive adjustment. If `diff < -5`, it gets the negative adjustment. Otherwise, the adjustment is zero.

## Margins and Operating Leverage: 0 to 20

This component has two sub-scores.

### EBITDA Margin Expansion: 0 to 10

The formula compares current EBITDA margin to the year-ago EBITDA margin:

```text
bps_change = (current_ebitda_margin - prior_ebitda_margin) * 100
```

| EBITDA Margin Change | Score |
|---:|---:|
| `>= 1000 bps` | 10 |
| `>= 500 bps` | 8 |
| `>= 200 bps` | 6 |
| `>= 50 bps` | 4 |
| `>= 0 bps` | 2 |
| `< 0 bps` | 0 |
| Missing margin data | 5 |

### Incremental Margin: 0 to 10

Incremental margin estimates how much of each new revenue dollar became EBITDA.

| Incremental Margin | Score |
|---:|---:|
| `>= 70%` | 10 |
| `>= 50%` | 8 |
| `>= 30%` | 6 |
| `>= 15%` | 4 |
| `>= 5%` | 2 |
| `< 5%` | 0 |
| Missing inputs | 5 |

## Profitability Quality: -2 to 15

This component has two sub-scores.

### EBITDA Margin Level: 0 to 8

| Current EBITDA Margin | Score |
|---:|---:|
| `>= 50%` | 8 |
| `>= 30%` | 6 |
| `>= 15%` | 4 |
| `>= 5%` | 2 |
| `>= 0%` | 1 |
| `< 0%` | 0 |
| Missing EBITDA margin | 4 |

### Free Cash Flow Margin: -2 to 7

```text
fcf_margin = free_cash_flow / revenue_recent_quarterly * 100
```

| FCF Margin | Score |
|---:|---:|
| `>= 30%` | 7 |
| `>= 15%` | 5 |
| `>= 5%` | 3 |
| `>= 0%` | 1 |
| `>= -5%` | 0 |
| `>= -20%` | -1 |
| `< -20%` | -2 |
| Missing FCF or revenue | 3 |

## Share Count Discipline: -10 to +10

This component uses YoY share count change.

| Share Count YoY Change | Score |
|---:|---:|
| `< 0%` | 10 |
| `< 2%` | 5 |
| `< 5%` | 0 |
| `< 10%` | -5 |
| `>= 10%` | -10 |
| Missing share count change | -2 |

Recent IPO adjustment: if the IPO was less than 18 months before the analysis date, the maximum penalty is capped at -5.

## Saul Rule Alignment: 0 to 15

This component uses the rule evaluation output.

| Rule Alignment Condition | Score |
|---|---:|
| Tier 1 rules exist and have zero fails | 6 |
| Tier 2 applicable rules have zero fails | 4 |
| Tier 3 applicable rules have at least 5 passes | 5 |

`N/A` rules are excluded from the Tier 2 and Tier 3 applicable sets.

## Data Sources

The formula primarily reads from `*_dashboard_metrics.json`:

| Formula Area | Source Fields |
|---|---|
| Valuation | `quantitative.price_and_valuation.run_rate_pe` |
| Growth | `quantitative.quarterly_history[0].revenue_yoy_pct`, `revenue_qoq_pct`, and prior quarter QoQ |
| Margins | `quantitative.quarterly_history[*].ebitda_margin_pct`, `quantitative.profitability_and_ebitda.ebitda_yoy_pct` |
| Profitability | `quantitative.profitability_and_ebitda.ebitda_margin_pct`, `quantitative.cash_flow.free_cash_flow`, `quantitative.income_statement.revenue_recent_quarterly` |
| Share count | `quantitative.price_and_valuation.shares_yoy_change_pct`, `ipo_date` |
| Rule alignment | `*_evaluation_results.json` rule evaluations |

The generation pipeline stores the final result in:

```json
{
  "evaluation": {
    "quality_score": 82,
    "quality_breakdown": {
      "valuation": 9,
      "growth": 17,
      "margins_op_leverage": 16,
      "profitability": 15,
      "share_count": 10,
      "rule_alignment": 15
    }
  }
}
```

## Dashboard Behavior

The StockDashboard server normalizes `evaluation.quality_score` into `company.qualityScore`.

The Summary dashboard then renders that value in the `Companies I Own` table as a compact badge:

| Score | Badge Color |
|---:|---|
| `80+` | High |
| `60 to 79` | Medium |
| `< 60` | Low |
| Missing | `N/A` |

The display is intentionally direct: the dashboard does not recompute the formula. It only reads the score produced by the report generation pipeline.
