# Deployment Automation

This repository now includes CI/CD automation in `.github/workflows/ci-cd.yml`.

## What happens automatically

- On every PR to `main`: install dependencies and run a production build.
- On every push to `main`: run build, apply tracked SQL migrations to production (if configured), then trigger deploy hooks (if configured).
- On manual `workflow_dispatch`: run the same migration + deploy pipeline.

## 1) Choose hosting

Recommended split for this codebase:

- Frontend (Vite static files): Vercel or Netlify
- Backend (`server/index.js`): Render Web Service or Railway Service
- Database: managed MySQL (PlanetScale, Railway MySQL, Aiven, etc.)

The pipeline is host-agnostic. GitHub Actions handles verification and database migration, then calls your host deploy hooks.

## 2) Configure backend service

Use:

- Build command: `npm ci`
- Start command: `npm run server`

Set backend environment variables at your host:

- `PORT` (host may set this automatically)
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`
- `CLIENT_URL` (your frontend production URL, comma-separated if multiple)
- `ANTHROPIC_API_KEY` (if used)
- `ANTHROPIC_MODEL` (optional override)

## 3) Configure frontend service

Use:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`

Set frontend environment variables:

- `VITE_API_URL` = your backend URL + `/api` (example: `https://api.example.com/api`)
- `VITE_OPENAI_API_KEY` (only if you intentionally allow client-side usage)

## 4) Configure GitHub Actions secrets

Add these repository secrets in GitHub:

- `PROD_DB_HOST`
- `PROD_DB_USER`
- `PROD_DB_PASSWORD`
- `PROD_DB_NAME`
- `PROD_DB_PORT`
- `FRONTEND_DEPLOY_HOOK_URL`
- `BACKEND_DEPLOY_HOOK_URL`

The database secrets allow the workflow to run `npm run migrate:pending` before deploy. The hook secrets let GitHub trigger your frontend and backend redeploys after migrations succeed.

## 5) Add deploy hooks (for auto deploy on push)

Create one deploy hook URL in your frontend host and one in your backend host.

After this, every push to `main` will trigger deployment automatically.

## 6) Run migrations locally or manually

To apply any new SQL files that have not yet been tracked:

```bash
npm run migrate:pending
```

To apply one specific SQL file and mark it as tracked:

```bash
npm run migrate:sql -- server/migrations/2026-03-08_workout_day_summaries.sql
```

## 7) Optional manual trigger from local machine

You can still trigger hooks manually with:

```bash
npm run deploy:hooks
```

PowerShell example:

```powershell
$env:FRONTEND_DEPLOY_HOOK_URL="https://example.com/frontend-hook"
$env:BACKEND_DEPLOY_HOOK_URL="https://example.com/backend-hook"
npm run deploy:hooks
```

## Notes

- The tracked migration runner stores applied files in `schema_migrations`.
- Do not edit a migration file after it has run in production. Add a new SQL file instead.
- If the production database secrets are missing, the workflow warns and skips the migration step.
