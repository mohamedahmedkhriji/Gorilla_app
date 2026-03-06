# Deployment Automation

This repository now includes CI/CD automation in `.github/workflows/ci-cd.yml`.

## What happens automatically

- On every PR to `main`: install dependencies and run a production build.
- On every push to `main`: run build, then trigger deploy hooks (if configured).

## 1) Choose hosting

Recommended split for this codebase:

- Frontend (Vite static files): Vercel or Netlify
- Backend (`server/index.js`): Render Web Service or Railway Service
- Database: managed MySQL (PlanetScale, Railway MySQL, Aiven, etc.)

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

## 4) Add deploy hooks (for auto deploy on push)

Create one deploy hook URL in your frontend host and one in your backend host.

Then add these GitHub repository secrets:

- `FRONTEND_DEPLOY_HOOK_URL`
- `BACKEND_DEPLOY_HOOK_URL`

After this, every push to `main` will trigger deployment automatically.

## 5) Optional manual trigger from local machine

You can trigger hooks manually with:

```bash
npm run deploy:hooks
```

PowerShell example:

```powershell
$env:FRONTEND_DEPLOY_HOOK_URL="https://example.com/frontend-hook"
$env:BACKEND_DEPLOY_HOOK_URL="https://example.com/backend-hook"
npm run deploy:hooks
```
