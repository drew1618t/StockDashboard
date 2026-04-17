# Current Code Map

This document maps the actual codebase as it exists today. Use it as the repo tour: where requests enter, where product areas live, which files own data, and which assets pair with each server module.

Keep `docs/architecture.md` focused on the desired boundaries. Keep this file focused on the current implementation.

## Level 0: Runtime Entry

```text
server/index.js
```

Owns process startup only:

- loads portfolio data through `server/dataLoader.js`
- starts live portfolio polling through `server/sheetsPoller.js`
- imports existing pigeon data when needed through `server/pigeonImport.js`
- creates and listens on the Express app from `server/createApp.js`

Do not add product routes or page rendering here.

## Level 1: App Assembly And Request Gates

```text
server/createApp.js
server/auth/accessAuth.js
server/auth/authorize.js
server/auth/config.js
server/middleware/requireAuthor.js
server/middleware/securityHeaders.js
```

`server/createApp.js` owns the Express app shell:

- compression, JSON parsing, and security headers
- Cloudflare Access auth and local development override
- static file mounting from `public/`
- route module mounting
- root page rendering through `server/homePage.js`

Auth rules live below `server/auth/`. Shared middleware lives below `server/middleware/`.

## Level 2: Route Modules

Routes are grouped by product area. Each route module should translate HTTP requests into store/service calls and responses. Keep persistence and business logic out of the route layer when it can live in a store or service.

```text
server/routes/portfolioRoutes.js
server/routes/requestRoutes.js
server/routes/staticPageRoutes.js
server/routes/writingRoutes.js
server/routes/family/pageRoutes.js
server/routes/family/taxRoutes.js
server/routes/family/pigeonRoutes.js
server/routes/family/todoRoutes.js
server/routes/family/pinboardRoutes.js
server/routes/family/miscRoutes.js
```

Current public route groups:

```text
/                       home page
/dashboard              static dashboard shell
/privacy                static privacy page
/requests               static requests page
/writing                writing index
/writing/analytics      writing analytics page
/writing/:slug          writing detail page
/api/portfolio          portfolio data
/api/stock/:ticker      single-stock data
/api/available-tickers  ticker list
/api/refresh            reload portfolio source data
/api/live-portfolio     live Google Sheets portfolio data
/api/health             API health check
/api/requests           request tracker API
/api/writing            writing API
```

Current family route groups are mounted behind `requireRole('family')`:

```text
/family                         family hub
/family/pigeons                 pigeon page
/family/health                  health hub
/family/health/:personSlug/...  health bloodwork, reports, images, and raw assets
/family/medical                 medical placeholder page
/family/todos                   todo page
/family/cameras                 cameras placeholder page
/api/family/taxes               tax planning API
/api/family/pigeons             pigeon API
/api/family/todos               todo API
/api/family/pinboard            pinboard API
/api/family/medical/summary     medical summary placeholder API
/api/family/cameras             camera placeholder API
```

## Level 3: Server Product Logic

These modules own the application behavior behind the routes.

Portfolio:

```text
server/dataLoader.js
server/sheetsPoller.js
server/calculator.js
server/normalizer.js
server/saulUtils.js
```

Writing:

```text
server/writingStore.js
server/writingPage.js
server/writingAnalytics.js
server/markdownParser.js
```

Family and health:

```text
server/familyPages.js
server/healthData.js
server/healthPageViews.js
server/todoStore.js
server/pinboardStore.js
```

Pigeons:

```text
server/pigeonStore.js
server/pigeonPages.js
server/pigeonImport.js
```

Taxes:

```text
server/taxStore.js
server/usFederalTax.js
```

Shared server helpers:

```text
server/utils/html.js
server/utils/jsonFileStore.js
server/utils/pathSafety.js
```

Use `server/utils/jsonFileStore.js` for JSON-backed stores unless a store has a specific reason to manage persistence itself. Use `server/utils/pathSafety.js` for file paths that come from routes, uploads, or user-controlled values.

## Level 4: Browser Assets

The browser side is plain static CSS and JS. There is no frontend build step.

Dashboard shell:

```text
public/index.html
public/dashboard.html
public/js/app.js
public/js/api.js
public/js/themeManager.js
public/js/dashboards/*.js
public/js/components/*.js
public/js/utils/*.js
public/css/base.css
public/css/components.css
public/css/mobile.css
public/css/themes/*.css
```

Writing pages:

```text
public/js/writing.js
public/css/writing.css
```

Family pages:

```text
public/js/familyHub.js
public/css/familyHub.css
```

Pigeon pages:

```text
public/js/pigeons.js
public/css/pigeons.css
```

Shared assets:

```text
public/css/fonts.css
public/fonts/*.woff2
public/vendor/chart.umd.min.js
```

When adding or moving a page, keep server-rendered markup in a server page module and browser behavior/styles in `public/js` and `public/css`.

## Level 5: Data And User State

Checked-in and runtime data currently live under `data/`.

JSON-backed app state:

```text
data/requests.json
data/writing.json
data/writing-analytics.json
data/todos.json
data/pinboard.json
data/health-hub.json
data/taxes.state.json
data/taxes.template.json
```

Pigeon data:

```text
data/pigeons.db
data/pigeons.db-shm
data/pigeons.db-wal
data/pigeons-uploads/
```

Portfolio and tax source files:

```text
data/*Positions*.csv
data/*Schwab*.pdf
```

Uploaded or source documents:

```text
data/*.pdf
```

Do not mix user data edits with structural refactors. Keep code changes and data changes separate when staging or committing.

## Level 6: Tests

The project uses Node's built-in test runner.

```text
test/auth.test.js
test/jsonFileStore.test.js
test/pigeonStore.test.js
test/renderers.test.js
test/routeSmoke.test.js
test/taxStore.test.js
```

Use `test/routeSmoke.test.js` for route assembly and auth boundary coverage. Use store-specific tests when changing persistence or parsing behavior.

## Level 7: Operations And Deployment

```text
scripts/deploy-pi.ps1
deploy/pi-target.json
systemd/portfolio-viz.service
```

Deployment targets the Raspberry Pi service defined in `systemd/portfolio-viz.service`. The deploy script reads `deploy/pi-target.json`, pulls `origin/main` on the Pi, installs production dependencies, restarts the service, and prints service status.

## Level 8: Design And Experiments

```text
demos/*.html
design-concepts/*.html
Writings/
```

These files are references, experiments, or writing artifacts. Do not treat them as runtime app code unless a feature explicitly promotes one into `server/` or `public/`.

## Keeping This Current

Update this file when:

- adding a new product area
- moving route ownership
- adding a new persistent data store
- adding a new runtime directory
- changing deployment shape

Do not document every function here. Prefer stable ownership boundaries and route groups.
