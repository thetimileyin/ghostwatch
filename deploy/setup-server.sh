#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 server (run as root).
# Installs Postgres, Node 22, Caddy (automatic HTTPS), a firewall and automatic security updates,
# creates the `ghost` service user and database, and installs the systemd services.
# Safe to re-run: every step checks before it changes anything.
set -euo pipefail

DOMAIN="${DOMAIN:-bitcoinghostwatch.online}"
APP=/opt/ghostwatch
ENV_DIR=/etc/ghostwatch

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq ca-certificates curl gnupg ufw unattended-upgrades postgresql rsync debian-keyring debian-archive-keyring apt-transport-https

# Node 22 from NodeSource's signed apt repository (Ubuntu's own Node is too old).
if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q && apt-get install -yq nodejs
fi

# Caddy from its signed apt repository.
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -yq caddy
fi

# 2 GB swap so builds never run out of memory on a 4 GB server.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Firewall: SSH and web only.
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

# Automatic security updates.
dpkg-reconfigure -f noninteractive unattended-upgrades

# Service user and app folder.
id ghost >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin ghost
install -d -o ghost -g ghost "$APP"

# Database and credentials (generated once, kept in /etc/ghostwatch/env).
install -d -m 0750 -o root -g ghost "$ENV_DIR"
if [ ! -f "$ENV_DIR/env" ]; then
  DB_PASS="$(openssl rand -hex 24)"
  sudo -u postgres psql -qc "CREATE ROLE ghostwatch LOGIN PASSWORD '$DB_PASS';"
  sudo -u postgres psql -qc "CREATE DATABASE ghostwatch OWNER ghostwatch;"
  cat > "$ENV_DIR/env" <<ENV
NODE_ENV=production
DATABASE_URL=postgres://ghostwatch:${DB_PASS}@127.0.0.1:5432/ghostwatch
DATABASE_POOL_MAX=10
BITCOIN_RPC_URLS=https://bitcoin-rpc.publicnode.com
MIN_DORMANT_YEARS=5
POLL_SECONDS=60
PUBLIC_BASE_URL=https://${DOMAIN}
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=
TELEGRAM_MIN_YEARS=10
TELEGRAM_MIN_BTC=1
ENV
  chmod 0640 "$ENV_DIR/env" && chown root:ghost "$ENV_DIR/env"
fi

# Services and web server config (copied by deploy.sh into $APP/deploy first).
install -m 0644 "$APP/deploy/ghostwatch-web.service" /etc/systemd/system/
install -m 0644 "$APP/deploy/ghostwatch-worker.service" /etc/systemd/system/
sed "s/{{DOMAIN}}/$DOMAIN/g" "$APP/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable ghostwatch-web ghostwatch-worker >/dev/null
systemctl reload caddy || systemctl restart caddy

echo "Server ready. Next: deploy.sh builds and starts the app."
