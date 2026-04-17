# StockDashboard Architecture

This project is a no-build Node/Express website with static browser assets. Keep the architecture simple: server modules own routing, services/stores own data behavior, and `public/` owns browser CSS/JS.

For a map of the current files and ownership levels, see `docs/code-map.md`.

## Runtime Shape

```text
server/index.js
  -> startup only
  -> load portfolio data
  -> start Google Sheets polling
  -> prepare pigeon data
  -> createApp().listen(...)

server/createApp.js
  -> Express app assembly
  -> compression/json/security middleware
  -> Cloudflare Access auth
  -> route mounting
  -> static asset mounting
```

`server/index.js` should not accumulate product routes or page rendering. Put new routes in `server/routes/` and mount them from `server/createApp.js`.

## Main Layers

```text
server/
  auth/             Cloudflare Access config, JWT verification, role checks
  middleware/       Shared Express middleware
  routes/           HTTP endpoints grouped by product area
  utils/            Shared server helpers
  *Store.js         Data access and persistence modules
  *Page.js          Server-rendered HTML page modules

public/
  css/              Browser CSS
  js/               Browser JS
  fonts/            Self-hosted fonts
  vendor/           Checked-in browser vendor assets

test/
  *.test.js         Node test runner tests
```

## Route Ownership

Routes are grouped by product area:

```text
server/routes/portfolioRoutes.js
  /api/portfolio
  /api/stock/:ticker
  /api/available-tickers
  /api/refresh
  /api/live-portfolio
  /api/live-portfolio/refresh
  /api/health

server/routes/requestRoutes.js
  /api/requests

server/routes/writingRoutes.js
  /writing
  /writing/analytics
  /writing/:slug
  /writing/:slug/export
  /api/writing
  /api/writing/upload
  /api/writing/:id
  /api/writing/analytics

server/routes/staticPageRoutes.js
  /privacy
  /requests
  /dashboard
  * dashboard fallback

server/routes/family/
  pageRoutes.js      /family and /family/health pages
  taxRoutes.js       /api/family/taxes...
  pigeonRoutes.js    /api/family/pigeons...
  todoRoutes.js      /api/family/todos...
  pinboardRoutes.js  /api/family/pinboard...
  miscRoutes.js      placeholder family APIs
```

`/api/family` and `/family` are mounted behind `requireRole('family')` in `server/createApp.js`.

## Rendering And Assets

Server-rendered pages should produce markup, not large inline applications.

Preferred pattern:

```text
server/writingPage.js       markup helpers
public/css/writing.css      writing page styles
public/js/writing.js        writing page browser behavior

server/familyPages.js       family hub + generic family layout markup
public/css/familyHub.css    family hub styles
public/js/familyHub.js      family hub browser behavior
```

Avoid adding new giant `<style>` or `<script>` blocks inside server-rendered template strings. A tiny bootstrap script is acceptable when it prevents visual flash, such as theme selection before CSS loads.

## Data And Persistence

Current persistence is intentionally lightweight:

```text
server/dataLoader.js          portfolio report loading
server/sheetsPoller.js        Google Sheets live portfolio polling
server/requestTracker.js      data/requests.json
server/writingStore.js        data/writing.json
server/writingAnalytics.js    data/writing-analytics.json
server/todoStore.js           data/todos.json
server/pinboardStore.js       data/pinboard.json
server/taxStore.js            Schwab tax source files + state
server/pigeonStore.js         SQLite pigeon database
```

JSON-backed stores should use `server/utils/jsonFileStore.js` unless there is a specific reason not to. Path-sensitive file serving or upload cleanup should use `server/utils/pathSafety.js`.

Do not mix user data changes with structural refactors. Commit code and data edits separately.

## Auth Model

Cloudflare Access auth lives under `server/auth/`.

The runtime auth flow is:

```text
createAccessAuth()
  -> verifies Cloudflare Access JWT or DEV_ACCESS_EMAIL override
  -> assigns req.user = { email, role, subject, issuer }

requireAuth
  -> blocks unauthenticated requests

requireRole('family')
  -> protects family pages and APIs
```

For local development, use `DEV_ACCESS_EMAIL` with matching `FAMILY_EMAILS` or general allowlist settings. Do not hardcode local auth bypasses into routes.

## Testing

The project uses Node's built-in test runner:

```powershell
npm test
```

Important test groups:

```text
test/auth.test.js           auth boundaries
test/pigeonStore.test.js    pigeon database behavior
test/taxStore.test.js       tax parsing/planning
test/routeSmoke.test.js     route assembly and auth smoke tests
test/renderers.test.js      server-rendered health page smoke tests
test/jsonFileStore.test.js  shared JSON helper behavior
```

When moving routes or page assets, add route smoke tests before the move and keep them green during the refactor.

## Adding A New Feature

Use this checklist:

1. Pick the product area.
2. Add or update a route module under `server/routes/`.
3. Keep data access in a store/service module, not in `server/createApp.js`.
4. Put browser CSS/JS in `public/css` and `public/js`.
5. Add a route smoke test for new protected route behavior.
6. Run `npm test` and `git diff --check`.

## Deployment

The Pi deployment path is:

```text
scripts/deploy-pi.ps1
  -> reads deploy/pi-target.json
  -> ssh to the Pi
  -> git pull --ff-only origin main
  -> npm install --omit=dev
  -> sudo systemctl restart portfolio-viz
  -> systemctl status portfolio-viz --no-pager
```

Deploy only after pushing the commit to `origin/main`.
