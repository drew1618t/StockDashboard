# StockDashboard

Private personal dashboard and the operational source of truth for current investing state.

## Investing responsibility

StockDashboard owns current holdings, position weights, live prices, portfolio performance,
configured brokerage position and transaction files, and tax state. It consumes company
research and dashboard metrics from the sibling `../SaulInvesting` project as read-only input.

The live Google Sheet portfolio is cached in memory and persisted to
`data/live-portfolio-snapshot.json`. Consumers should resolve current portfolio data in this
order:

1. `/api/live-portfolio`
2. `data/live-portfolio-snapshot.json`
3. `portfolio.json` for the holding set only
4. dated historical snapshots in `../SaulInvesting/portfolio_data`

The persisted snapshot and local configuration are intentionally gitignored because they can
contain private portfolio information.

Put current household brokerage transaction CSV exports under `data/transactions/`. Existing
single-account tax configuration remains supported through `data/taxes.state.json`; sibling
workflows combine that configured CSV with any additional CSVs in this directory.

## Configuration

Defaults live in `config/default.json`. To override them locally, copy
`config/local.example.json` to `config/local.json`. Environment variables take precedence:

- `DATA_DIR`
- `SHEETS_CSV_URL`
- `SHEETS_POLL_INTERVAL_MS`
- `LIVE_PORTFOLIO_SNAPSHOT_PATH`
- `INVESTING_CONFIG_PATH`

## Development

```powershell
npm test
npm run dev
```

See `docs/architecture.md`, `docs/code-map.md`, and `docs/development.md` for implementation and
deployment details.

The application also hosts private family, health, animal, tax, writing, and project pages. The
broader portal scope is intentional even though the historical repository name is StockDashboard.

The canonical three-project ownership map is documented in
`../SaulInvesting/docs/investing-workspace.md`.
