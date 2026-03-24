param(
  [string]$RemoteHost = "159.89.21.234",
  [string]$User = "root",
  [string]$KeyPath = "$HOME\.ssh\droplet_codex",
  [string]$RemoteAppDir = "/root/Gorilla_app",
  [string]$StaticDir = "/var/www/repset",
  [string]$NginxSite = "repset",
  [string]$ClientUrl = "https://repset.org,https://www.repset.org,http://repset.org,http://www.repset.org",
  [int]$NodeMaxOldSpaceSizeMb = 1536,
  [switch]$SkipNpmCi
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $KeyPath)) {
  throw "SSH key not found: $KeyPath"
}

$npmInstallLine = if ($SkipNpmCi) { "echo 'Skipping npm ci'" } else { "npm ci" }

$remoteScript = @'
set -euo pipefail

APP_DIR="__APP_DIR__"
STATIC_DIR="__STATIC_DIR__"
NGINX_SITE="__NGINX_SITE__"
CLIENT_URL_VALUE="__CLIENT_URL__"
RUN_NPM_CI="__RUN_NPM_CI__"
NODE_MAX_OLD_SPACE_SIZE_MB="__NODE_MAX_OLD_SPACE_SIZE_MB__"

cd "$APP_DIR"

git fetch origin main
git pull --ff-only origin main

if [ ! -f .env ]; then
  echo "Remote .env file is missing. Create /root/Gorilla_app/.env before deploying."
  exit 1
fi

stamp=$(date +%Y%m%d-%H%M%S)
cp .env "/root/.env.backup.deploy-$stamp"

upsert_env() {
  key="$1"
  value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s#^${key}=.*#${key}=${value}#" .env
  else
    printf '\n%s=%s\n' "$key" "$value" >> .env
  fi
}

read_env_value() {
  key="$1"
  grep "^${key}=" .env | tail -n 1 | cut -d '=' -f 2-
}

upsert_env "CLIENT_URL" "$CLIENT_URL_VALUE"
upsert_env "VITE_API_URL" "/api"
upsert_env "VITE_SOCKET_URL" "/"

if [ -z "$(read_env_value AUTH_SECRET)" ]; then
  upsert_env "AUTH_SECRET" "$(openssl rand -hex 48)"
fi

if [ -z "$(read_env_value ANTHROPIC_MODEL)" ]; then
  upsert_env "ANTHROPIC_MODEL" "claude-sonnet-4-6"
fi

if [ -z "$(read_env_value OPENAI_BIWEEKLY_REPORT_MODEL)" ]; then
  upsert_env "OPENAI_BIWEEKLY_REPORT_MODEL" "gpt-4o"
fi

if [ -f .gitattributes ] && grep -q "filter=lfs" .gitattributes; then
  if ! git lfs version >/dev/null 2>&1; then
    echo "Git LFS is required on the VPS for this repo. Install git-lfs and run git lfs pull before deploying."
    exit 1
  fi
  git lfs pull
fi

eval "$RUN_NPM_CI"
npm run migrate:pending
NODE_OPTIONS="--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE_MB}" npm run build

mkdir -p "$STATIC_DIR"
find "$STATIC_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a dist/. "$STATIC_DIR/"
chown -R www-data:www-data "$STATIC_DIR"
find "$STATIC_DIR" -type d -exec chmod 755 {} +
find "$STATIC_DIR" -type f -exec chmod 644 {} +

cat > /etc/systemd/system/gorilla-backend.service <<'UNIT'
[Unit]
Description=Gorilla App Backend
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=__APP_DIR__
ExecStart=/usr/bin/npm run server
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT

TLS_CERT_DIR="/etc/letsencrypt/live/repset.org"
HAS_TLS="0"
if [ -f "${TLS_CERT_DIR}/fullchain.pem" ] && [ -f "${TLS_CERT_DIR}/privkey.pem" ]; then
  HAS_TLS="1"
fi

if [ "$HAS_TLS" = "1" ]; then
  cat > "/etc/nginx/sites-available/${NGINX_SITE}" <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 159.89.21.234 repset.org _;
    return 301 https://www.repset.org$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name www.repset.org;
    return 301 https://www.repset.org$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.repset.org;

    ssl_certificate /etc/letsencrypt/live/repset.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/repset.org/privkey.pem;

    root __STATIC_DIR__;
    index index.html;
    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /health {
        proxy_pass http://127.0.0.1:5001/health;
        proxy_set_header Host $host;
    }

    location = /admin.html {
        try_files /admin/index.html =404;
    }

    location /assets/ {
        try_files $uri =404;
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /admin/ {
        try_files $uri $uri/ /admin/index.html;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
else
  cat > "/etc/nginx/sites-available/${NGINX_SITE}" <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 159.89.21.234 repset.org _;
}

server {
    listen 80;
    listen [::]:80;
    server_name www.repset.org;

    root __STATIC_DIR__;
    index index.html;
    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5001/socket.io/;
        proxy_http_version 1.1;
        proxy_connect_timeout 30s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /health {
        proxy_pass http://127.0.0.1:5001/health;
        proxy_set_header Host $host;
    }

    location = /admin.html {
        try_files /admin/index.html =404;
    }

    location /assets/ {
        try_files $uri =404;
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /admin/ {
        try_files $uri $uri/ /admin/index.html;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
fi

ln -sfn "/etc/nginx/sites-available/${NGINX_SITE}" "/etc/nginx/sites-enabled/${NGINX_SITE}"

systemctl daemon-reload
systemctl stop gorilla-frontend || true
systemctl disable gorilla-frontend || true
systemctl enable gorilla-backend
systemctl restart gorilla-backend
nginx -t
systemctl restart nginx

for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:5001/health >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 20 ]; then
    echo "Backend health check failed after waiting for readiness."
    exit 1
  fi
  sleep 2
done

curl -fsS http://127.0.0.1:5001/health
if [ "$HAS_TLS" = "1" ]; then
  curl -kI -H 'Host: www.repset.org' https://127.0.0.1/
  curl -kI -H 'Host: www.repset.org' https://127.0.0.1/admin.html
else
  curl -I -H 'Host: www.repset.org' http://127.0.0.1/
  curl -I -H 'Host: www.repset.org' http://127.0.0.1/admin.html
fi
'@

$remoteScript = $remoteScript.
  Replace("__APP_DIR__", $RemoteAppDir).
  Replace("__STATIC_DIR__", $StaticDir).
  Replace("__NGINX_SITE__", $NginxSite).
  Replace("__CLIENT_URL__", $ClientUrl).
  Replace("__NODE_MAX_OLD_SPACE_SIZE_MB__", $NodeMaxOldSpaceSizeMb.ToString()).
  Replace("__RUN_NPM_CI__", $npmInstallLine)

$tmpFile = Join-Path $env:TEMP "gorella_deploy_vps.sh"
[System.IO.File]::WriteAllText($tmpFile, $remoteScript, [System.Text.UTF8Encoding]::new($false))

$remoteScriptPath = "/root/gorella_deploy_vps.sh"

try {
  & scp -i $KeyPath $tmpFile "${User}@${RemoteHost}:${remoteScriptPath}"
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to copy deploy script to server."
  }

  & ssh -i $KeyPath "${User}@${RemoteHost}" "bash ${remoteScriptPath}"
  if ($LASTEXITCODE -ne 0) {
    throw "Remote deploy failed."
  }
}
finally {
  if (Test-Path $tmpFile) {
    Remove-Item $tmpFile -Force
  }
}
