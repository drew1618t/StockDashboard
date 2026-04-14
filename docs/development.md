# Development Notes

This project is intentionally simple: CommonJS modules, Express, static CSS/JS, and no frontend build step.

## Common Commands

```powershell
npm test
npm start
npm run dev
```

`npm run dev` uses Node's watch mode:

```powershell
node --watch server/index.js
```

## Local Auth Bypass

Cloudflare Access is required by default. For local development, use the built-in dev override instead of changing route code.

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
powershell -ExecutionPolicy Bypass -File scripts\deploy-pi.ps1
```

The script deploys the current `origin/main` branch configured in `deploy/pi-target.json`. Push before deploying:

```powershell
git push origin main
```

The deploy script restarts the systemd service and prints service status.
