#!/usr/bin/env bash
# Ship the current code to the server, build it there, and restart.
# Usage (from the ghostwatch folder):  SERVER=1.2.3.4 deploy/deploy.sh [--setup]
#   --setup  also runs the one-time server setup first.
set -euo pipefail
: "${SERVER:?set SERVER to the server IP, e.g. SERVER=1.2.3.4}"
KEY="${KEY:-$HOME/.ssh/ghostwatch_hetzner}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new root@$SERVER"

cd "$(dirname "$0")/.."
echo "→ Copying code to $SERVER"
rsync -az --delete -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new" \
  --exclude node_modules --exclude .next --exclude .git --exclude '.env*' --exclude tsconfig.tsbuildinfo \
  ./ "root@$SERVER:/opt/ghostwatch/"

if [ "${1:-}" = "--setup" ]; then
  echo "→ One-time server setup"
  $SSH "bash /opt/ghostwatch/deploy/setup-server.sh"
fi

echo "→ Installing and building on the server"
$SSH "chown -R ghost:ghost /opt/ghostwatch && cd /opt/ghostwatch && sudo -u ghost bash -c 'set -a; . /etc/ghostwatch/env; set +a; npm ci --include=dev --no-audit --no-fund && npm run build'"

echo "→ Restarting"
$SSH "systemctl restart ghostwatch-web ghostwatch-worker && sleep 3 && systemctl is-active ghostwatch-web ghostwatch-worker caddy"
echo "Done."
