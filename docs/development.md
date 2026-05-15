# Development Notes

This project is intentionally simple: CommonJS modules, Express, static CSS/JS, and no frontend build step.

Use `docs/code-map.md` for the current file-level tour and `docs/architecture.md` for the intended boundaries.

## Common Commands

```powershell
npm test
npm start
npm run dev
```

`npm run dev` uses Node's watch mode:

```powershell
node --watch local.js
```

## Local Auth Bypass

Cloudflare Access is required by default for `npm start`. For local development, use `npm run dev`;
it starts `local.js`, bypasses Cloudflare Access, and grants a family-role user.

To test the real Cloudflare Access path locally, use:

```powershell
npm run dev:access
```

That script expects the Access environment variables to be configured. You can also use the
built-in dev override instead of changing route code.

Example family session:

```powershell
$env:PORT='3000'
$env:NODE_ENV='development'
$env:DEV_ACCESS_EMAIL='drew1618t@gmail.com'
$env:FAMILY_EMAILS='drew1618t@gmail.com'
$env:ALLOW_GENERAL_DOMAINS='example.org'
npm start
```

Then open:

```text
http://localhost:3000
```

Confirm the effective role:

```powershell
Invoke-RestMethod http://localhost:3000/api/me
```

Expected family response:

```json
{
  "authenticated": true,
  "email": "drew1618t@gmail.com",
  "role": "family"
}
```

## Local Smoke Check

After route or renderer changes, check:

```text
/
/dashboard
/writing
/family
/family/pigeons
/family/health/andrew
```

The test suite also covers these paths through injected auth/dependencies:

```powershell
npm test
```

## Commit Hygiene

Do not commit personal/generated files with code refactors.

Common data files to keep separate:

```text
data/todos.json
data/writing.json
data/writing-analytics.json
data/pinboard.json
data/pigeons.db*
data/pigeons-uploads/
```

Before committing:

```powershell
git status --short
git diff --check
npm test
```

Stage code intentionally. Example:

```powershell
git add server public test docs
git commit -m "Document site architecture"
```

## Pi Deploy

Deploy uses the checked-in script and target config:

```powershell
git push origin main
powershell -ExecutionPolicy Bypass -File scripts\deploy-pi.ps1
```

The target is configured in `deploy/pi-target.json`. The current target is the `portfolio-viz`
service on the Raspberry Pi at `/home/andrew/StockDashboard`, deploying the `main` branch.

The script SSHes to the Pi and runs the deploy from the remote checkout:

```text
git pull --ff-only origin main
npm install --omit=dev
sudo systemctl restart portfolio-viz
systemctl status portfolio-viz --no-pager
```

Before pulling, the script preserves runtime-edited JSON files on the Pi so a deploy does not
overwrite live app data:

```text
data/todos.json
data/writing-analytics.json
data/writing.json
portfolio.json
```

It also copies legacy `data/taxes.json` to `data/taxes.state.json` on the Pi if the state file
does not exist yet, then restores the tracked `data/taxes.json` before pulling.

## Health Reports On The Pi

Health report documents and health SQLite databases are not pushed by `scripts\deploy-pi.ps1`.
The health pages read external runtime paths from environment variables in the Pi service env:

```text
HEALTH_ANDREW_ROOT
HEALTH_ANDREW_REPORTS_DIR
HEALTH_ANDREW_DB_PATH
HEALTH_ANDREW_IMAGING_DIR
HEALTH_KAILI_ROOT
HEALTH_KAILI_REPORTS_DIR
HEALTH_KAILI_DB_PATH
HEALTH_KAILI_IMAGING_DIR
HEALTH_PYTHON_BIN
```

Those values are normally supplied by `/home/andrew/StockDashboard/.env.production`, loaded by
`systemd/portfolio-viz.service`.

To push new health reports, sync the generated health files to the Pi paths configured in that
env file, then restart the service if the database or environment changed. There is currently no
checked-in health sync script.
