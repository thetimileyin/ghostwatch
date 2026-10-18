#!/usr/bin/env bash
# Rebuild the archive on the server by replaying the detector over the same past blocks
# as the local archive (list in deploy/archive-heights.txt). Run once after the first deploy.
set -euo pipefail
: "${SERVER:?set SERVER to the server IP}"
KEY="${KEY:-$HOME/.ssh/ghostwatch_hetzner}"
HEIGHTS="$(paste -sd, "$(dirname "$0")/archive-heights.txt")"
ssh -i "$KEY" "root@$SERVER" "cd /opt/ghostwatch && sudo -u ghost bash -c 'set -a; . /etc/ghostwatch/env; set +a; npm run backfill -- --heights $HEIGHTS'"
