# GhostWatch

A live Bitcoin terminal that explains what's happening on-chain in plain words.

**Live:** https://bitcoinghostwatch.online

Block explorers show tables of hashes and amounts. GhostWatch tells the story instead:
where a transaction's coins came from, how long they sat, which block took it, and where
they went next. It also watches every new block for coins waking up after five years or more.

## What it does

- **Transaction journeys** (`/tx/<txid>`): a transaction explained step by step, from the coins it spends to where they went.
- **Addresses and blocks** (`/address/<addr>`, `/block/<height>`): the same plain-words view.
- **Awakenings**: every block is read for outputs unspent for 5+ years. Each one gets a permanent page, with what the chain proves and what it doesn't.
- **Live terminal** (`/terminal`): price, fees, the mempool, recent blocks, who's mining and node locations.
- **Watch a coin**: get told when a transaction confirms or its coins move. Saved only in your browser.
- **RSS** (`/feed.xml`) for awakenings, and a **Nostr account** that posts the notable ones (10+ years, 1+ BTC).

## Principles

- **No accounts, no tracking, no analytics.** Visitors' browsers never contact third-party APIs; our server fetches public data.
- **Public Bitcoin data only.** Block data comes from a Bitcoin node over RPC. Other sources have fallbacks, so no single API can take the site down.
- **Never guess identity.** An awakening is not proof of a sale, a hack, or who owns the coins.

## Run it locally

```bash
npm install
npm run db      # local Postgres (PGlite)
npm run dev     # website on http://localhost:3000
npm run worker  # follows the chain and detects awakenings
```

Settings live in `.env.local` (see `deploy/setup-server.sh` for the full list). Tests: `npm test`.

`npm run posts` prints ready-to-post drafts from the live site's data.

## Deploy

See [deploy/README.md](deploy/README.md).

## License

MIT. See [LICENSE](LICENSE).
