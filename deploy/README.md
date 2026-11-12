# Deploying GhostWatch (one server)

Everything runs on one Ubuntu server (24.04 or newer): the website (Next.js), the detector
(worker), Postgres, and Caddy for HTTPS. No analytics, no access logs.

## First time

1. Create the server with the `~/.ssh/ghostwatch_hetzner` SSH key (the name is historical;
   any host works). Live today: a DigitalOcean droplet in Frankfurt (Basic, 2 GB, Ubuntu
   26.04, 46.101.254.46). 2 GB is the minimum; the setup adds swap for builds.
2. From the `ghostwatch` folder:
   ```bash
   SERVER=<ip> deploy/deploy.sh --setup
   ```
   This copies the code, installs Postgres, Node 22, Caddy, a firewall and automatic
   security updates, creates the database (password generated on the server, kept in
   `/etc/ghostwatch/env`), builds the app and starts both services.
3. Point DNS at the server: `A` records (and `AAAA` if the server has IPv6) for `bitcoinghostwatch.online` and
   `www`. Caddy fetches the HTTPS certificate on its own once DNS resolves.
4. Rebuild the archive (same past blocks as the local archive):
   ```bash
   SERVER=<ip> deploy/restore-archive.sh
   ```

## Every update

```bash
SERVER=<ip> deploy/deploy.sh
```

## On the server

- Logs: `journalctl -u ghostwatch-web -f`, `journalctl -u ghostwatch-worker -f`
- Restart: `systemctl restart ghostwatch-web ghostwatch-worker`
- Settings (Telegram token etc.): `/etc/ghostwatch/env`, then restart the worker.
