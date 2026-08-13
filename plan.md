# Plan: Overlay Live Prices onto Report Data

## Goal
When the Google Sheets poller has a live price for a stock, use it (instead of the stale report-JSON price) for price, market cap, P/E ratios, P/S, GAV, and distance-from-high. When live data is unavailable (null), fall back to report values and visually flag them as outdated.

## Approach: Server-side overlay at response time

### 1. `server/index.js` — add `overlayLivePrices()` helper (~40 lines)

Called in both `/api/portfolio` and `/api/stock/:ticker` handlers, after data is loaded but before sending the response. For each company:

- Look up the ticker in `sheetsPoller.getLiveData().stocks`
- If live `currentPrice` exists and is not null:
  - Set `company.price` = live price
  - Recalculate `marketCapMil`: `(livePrice / reportPrice) * reportMarketCap` (proportional scaling — we don't have shares outstanding directly)
  - Back-derive EPS from each P/E variant: `eps = reportPrice / reportPE`, then recompute `PE = livePrice / eps`. Applied to `trailingPe`, `runRatePe`, `forwardPe`, `normalizedPe`
  - Recalculate `priceToSales`: `(livePrice / reportPrice) * reportPriceToSales`
  - Recalculate `distanceFromHigh`: `(livePrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh * 100`
  - Recalculate `calculated.gav`: uses updated P/E ÷ revenue growth
  - Recalculate `calculated.peCompression`: uses updated P/E values
  - Set `priceSource: "live"`
- If no live price: set `priceSource: "report"`

The overlay works on shallow copies (`companies.map(c => ({...c}))`) so it doesn't mutate the cached data.

### 2. `public/js/dashboards/deepDive.js` — stale indicator on Price & Market Cap (~10 lines)

In `_renderStock`, for the Price and Market Cap metric cards: if `company.priceSource === "report"`, append `subtext: "from report"` and add `colorClass: "stale"`.

### 3. `public/js/dashboards/summary.js` — no changes needed

Market cap total already reads from `company.marketCapMil` which will be updated by the overlay. No special stale indicator needed here since it's an aggregate.

### 4. `public/css/components.css` — `.stale` style (~5 lines)

```css
.metric-card.stale .metric-value {
  color: var(--color-warning);
  text-decoration: underline dashed;
}
```

This gives report-fallback values an amber dashed-underline treatment, clearly different from live data.

### 5. `public/js/dashboards/valuation.js` — no changes needed

The scatter plot, GAV bars, P/E bars, and quality table all read from `company.*` properties that will already be updated by the server overlay.

## What stays unchanged
- `server/normalizer.js` — untouched
- `server/calculator.js` — untouched (overlay recalculates the specific derived metrics inline)
- `server/sheetsPoller.js` — untouched
- `server/dataLoader.js` — untouched
- The live positions table in liveSection.js — untouched (still uses its own data path)
