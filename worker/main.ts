// Live worker: follows the chain tip, detects ghosts, publishes to Telegram.
// Usage: npm run worker [-- --start-height 971000]
import { pool, migrate } from "@/lib/db/pool";
import { recordError } from "@/lib/db/store";
import { LIVE_WORKER, syncOnce } from "@/lib/detector/ingest";
import { publishPending } from "@/lib/publish/telegram";
import { POLL_MS, ingestConfig } from "./config";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  await migrate();
  const cfg = ingestConfig();
  const startHeight = arg("--start-height") ? Number(arg("--start-height")) : undefined;
  const log = cfg.log!;
  log(`worker up · min ${cfg.minYears}y · poll ${POLL_MS / 1000}s · telegram ${process.env.TELEGRAM_BOT_TOKEN ? "on" : "off"}`);

  let stopping = false;
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => (stopping = true));

  let backoff = POLL_MS;
  while (!stopping) {
    try {
      // Cap each pass so a long catch-up still heartbeats and publishes regularly.
      const r = await syncOnce(cfg, { startHeight, maxBlocks: 6 });
      await publishPending(log);
      backoff = POLL_MS;
      if (r.height < r.tip) continue; // still catching up
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`error: ${msg}`);
      await recordError(LIVE_WORKER, msg).catch(() => {});
      backoff = Math.min(backoff * 2, 10 * 60_000);
    }
    await new Promise((r) => setTimeout(r, backoff));
  }
  await pool().end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
