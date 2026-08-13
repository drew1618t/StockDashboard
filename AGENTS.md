## Project role

- StockDashboard is the source of truth for current holdings, weights, prices, transactions, portfolio performance, and tax state.
- Read company reports and metrics from the configured sibling SaulInvesting root. Treat that project as read-only from this workflow.
- Earnings forecasts, tripwires, and quarterly scorecards belong in the sibling Earnings project. Do not create them here.
- Prefer `/api/live-portfolio` for current data. When the process is offline, use `data/live-portfolio-snapshot.json`; use `portfolio.json` only as a holdings list.
- Keep private runtime data and local configuration out of Git.
- Treat `../SaulInvesting/metrics_reference.json` as the canonical dashboard-metrics schema reference; do not keep a duplicate copy here.

## Development

- This is a no-build CommonJS Node/Express application.
- Keep routes under `server/routes`, data behavior in stores/services, and browser assets under `public`.
- Run `npm test` and `git diff --check` after changes.
- Preserve unrelated local and runtime-data changes when the worktree is dirty.
