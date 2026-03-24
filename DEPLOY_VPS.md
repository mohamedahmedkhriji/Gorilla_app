# VPS Deploy Flow

This repo includes a saved deploy flow for the current VPS deployment target.

## Current target

- Server IP: `159.89.21.234`
- SSH user: `root`
- SSH key: `C:\Users\Ahmed\.ssh\droplet_codex`
- Remote app dir: `/root/Gorilla_app`
- Static frontend dir: `/var/www/repset`
- Nginx site: `repset`

## What the script does

The script:

1. Connects to the VPS over SSH
2. Backs up the current `.env`
3. Sets production frontend env routing:
   - `CLIENT_URL=https://repset.org,https://www.repset.org,http://repset.org,http://www.repset.org`
   - `VITE_API_URL=/api`
   - `VITE_SOCKET_URL=/`
4. Pulls latest `main`
5. Runs `npm ci`
6. Runs `npm run migrate:pending`
7. Pulls Git LFS assets when the repo requires them
8. Builds the frontend with `NODE_OPTIONS=--max-old-space-size=384` by default to reduce OOM risk on the current 1 GB VPS
9. Publishes `dist/` to `/var/www/repset`
10. Rewrites the backend `systemd` unit in production mode
11. Rewrites the Nginx site to serve static files and proxy `/api` + `/socket.io`
   - Redirects `159.89.21.234` and `repset.org` to `https://www.repset.org`
   - Uses longer API/socket proxy timeouts to avoid false 504s during long AI plan generation
12. Restarts backend and Nginx
13. Verifies `/health`, `/`, and `/admin.html`

## Run it

From the repo root on this machine:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1
```

## Useful options

Skip `npm ci` if dependencies did not change:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 -SkipNpmCi
```

Override the host or key:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 -Host 159.89.21.234 -KeyPath "$HOME\.ssh\droplet_codex"
```

Adjust the frontend build heap limit if the VPS memory profile changes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-vps.ps1 -NodeMaxOldSpaceSizeMb 384
```

## Notes

- The VPS now serves the production frontend directly from Nginx instead of a Vite dev server.
- The backend runs as `gorilla-backend.service`.
- `gorilla-frontend.service` is intentionally disabled.
- This repo uses Git LFS media. The VPS must have `git-lfs` installed or the frontend build will publish tiny pointer files instead of real media assets.
- Even with the 384 MB Node heap cap, a full frontend build with all real media assets can still push this 1 GB VPS close to its memory ceiling. If deploys start failing again, build on a larger machine or free more memory during the build window.
- Point DNS A records for both `repset.org` and `www.repset.org` to `159.89.21.234`.
- Rotate exposed credentials after deployment.
