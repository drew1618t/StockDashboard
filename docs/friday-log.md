# Performance: Friday Log and Trades

The signed-in `#friday-log` tab is labeled Performance in the navigation. It has
two views chosen by `view=fridays` (default) or `view=trades` in the hash.

## Trades view

`/api/friday-log/trades?account=&from=&to=` returns FIFO trade statistics built
by `server/tradeStats.js` from the same ledger. Lots are built from every
recorded trade, back to the first imported export (Schwab history reaches 2022),
so a sale is judged against what the shares really cost. Shares held before the
ledger's first day are opening lots priced at that day's close: the combined
view unwinds the balance reference through every recorded trade to find them,
while an individual account has no dated reference, so its excess sells are
priced at that close as they occur. The period (default: the current year to
date) decides which sells, buys, income and flows are reported and dates the
valuation of open shares; `period=` in the hash selects a year or `all`.
`type=stocks` or `type=options` reports stocks and option contracts apart;
together, the view adds a stocks-versus-options breakdown.

Lots are matched per account; journaled shares close a lot in the sending
account and open one in the receiving account at the journal price, and never
count as a buy or sell. Journals that net to zero within one account on one day
are ignored. Splits from the price cache scale open lots; Schwab's own
`Stock Split` rows are recorded but change nothing. Option trades
(`Buy to Open`, `Sell to Close`) are tracked under the contract symbol with 100
shares per contract; rollovers (`Funds Received`) and wires count as external
flows, and margin interest, service fees and their waivers count as costs.

The view shows realized and unrealized gains, win rate, average win and loss,
profit factor and hold time (all judged per position, from first lot to the
sale of the last share, so a trim is never a result on its own), income and costs, the best and worst fully sold
positions and open holdings ranked by percentage, tables by stock, month and
account, and a ticker lookup (`symbol=` in the hash) that shows one stock's
averages, open lots and every ledger line. Looking up a ticker with no activity
in the chosen period switches to all time.

Quotes are downloaded from ten days before the first ledger day. A symbol last
traded before December 2025 keeps its saved history instead of being downloaded
again, and option symbols are never requested.

## Fridays view

The Fridays view uses the Year Atlas calendar. Its colors represent
the combined portfolio's weekly return, including cash equivalents, rather than
a single holding's performance. The browser calls `/api/friday-log` with a year
and account filter. Every Friday remains selectable after 6 p.m. New York time;
missing inputs produce a pending state rather than an invented return.

## Data and reconstruction

Private records live under ignored `data/friday-log/` (override with
`FRIDAY_LOG_DIR`). Back up this directory along with other private runtime data.
It contains original exports, normalized transactions, dated balance references,
captured balances, historical prices and regenerated yearly snapshots.

A balance reference contains a date, complete equity share quantities and cash
including SWVXX. The initial combined reference was read directly from the live
dashboard on September 24, 2026. All current equity quantities matched the
transaction reconstruction. The older September 17 cached cash balance was not
used, because it did not reconcile with the current live cash balance. The
opening-value comparison is shown in Sources & updates; the remaining small
difference from the dashboard's reported start-year total is not silently forced
to zero.

The engine reverses activity from the reference date back to December 31, 2025,
then reconstructs each Friday. It accounts for buys, sells, reinvestments,
dividends, interest, ADR fees, withdrawals, share journals and provider-reported
splits. SWVXX is valued at $1 within cash equivalents. Internal transfers cancel
when accounts are combined, and are external capital for an individual account.
Unsupported activity fails import rather than disappearing from the ledger.
The supplied exports are treated as complete from January 1, 2026 through their
declared export date. Schwab `as of` dates determine effective activity dates.

Import subsequent **full-history** exports under Sources & updates, specifying
the account and export-through date. Overlaps deduplicate, while identical fills
within one export retain their multiplicity. Corrections that change an existing
trade's economics require ledger review; they are not automatically inferred as
replacements. Combined coverage uses the earliest export-through date across all
four accounts. Account filters can show transactions without a balance reference;
account holdings and performance remain pending until a dated account reference
is supplied. `createFridayLogStore().setAnchor(accountId, reference)` provides the
same validated reference interface used for the combined account.

## Prices and performance

`fridayLogService` retrieves daily Yahoo Finance chart closes and split events,
with three concurrent requests and bounded timeouts. Failed requests preserve
the previous cache. SPY session dates identify the last exchange session on or
before a Friday. A ticker missing that session's close stays unavailable; it does
not borrow an arbitrarily stale price. Holiday weeks display the actual price
date. Yahoo's split-adjusted historical closes are converted to contemporaneous
share-unit prices; shares are separately adjusted for the split. Stock weekly
price returns adjust for splits, but not dividends, which are included in cash.

Portfolio weekly return uses Modified Dietz with day-end external-flow timing:

`return = (ending value - beginning value - net external flows) / (beginning value + day-weighted external flows)`

This estimates time-weighted performance. It is not an exact intraday
time-weighted return. Buys and sells transfer value between holdings and cash;
they are not external flows. Dividends, interest and fees affect performance.
The first 2026 portfolio period begins December 31; stock week % still compares
the prior weekly close. See the
[GIPS calculation guidance](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/).

Each Friday also shows portfolio YTD return, geometrically linking the unrounded,
flow-adjusted period returns from December 31 of the preceding year through that
Friday. When the first week spans December, only the January portion contributes
to YTD. Missing historical periods keep subsequent YTD figures pending; an
unknown return is never treated as zero. Future Fridays do not show a YTD value.

## Automatic capture and deployment

`prepareData()` starts an hourly job with an immediate startup catch-up. On
Fridays after 18:00 America/New_York, it requests a fresh Sheets balance and
persists the first acceptable after-close capture. It rejects stale, pre-close,
future-dated or invalid balances. Prices are refreshed and yearly snapshots are
persisted. Capture does not depend on opening the browser, but the Node process
must be running and the live holdings sheet must be current. On restart, covered
missed weeks can be reconstructed. Known transactions are also replayed beyond
their export date and compared with each Friday's saved Google Sheet snapshot.
Matching equity quantities and cash confirm the activity for that snapshot, so
weekly and YTD returns can finalize without another export. Cash tolerates one
cent of rounding difference; share quantities tolerate one millionth of a share.
A mismatch keeps the return pending and identifies the cash or stock quantities
that differ. The prior saved Friday balance is used when available. Missing
prices or earlier gaps in performance history still leave affected figures
pending. This comparison does not change the recorded CSV coverage dates or
invent transaction records. A Friday without a sheet capture still needs exports
covering that date for reconstruction; a combined capture does not verify an
individual account's balances.

The source code and private runtime directory are separate deployment inputs.
Git alone does not transfer balances, imports or reconstructed snapshots.
All signed-in dashboard users can read the history, including account activity.
Imports and manual price refreshes require the family role; other users do not
see those controls. Anonymous requests still require Cloudflare sign-in. The
routes send `Cache-Control: no-store`, and the runtime directory is outside the
public static root.

## Validation

`npm test` covers reverse trades, external flows, money-market reinvestment,
account transfers, overlapping exports, effective dates, missing prices,
holidays, splits, negative share reconstruction, capture timing, persistence,
provider failures and route access. A separate forward replay of the original
four CSVs was compared with all 38 completed 2026 snapshots, including quantities,
values and Modified Dietz returns. Browser verification covers calendar
navigation, stock details, account filters and mobile layout.
