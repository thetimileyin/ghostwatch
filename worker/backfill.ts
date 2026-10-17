// Archive backfill: run the same detector over past blocks and store results
// as origin='archive' (shown as Historical, never announced).
// Usage:
//   npm run backfill -- --heights 903916,903921
//   npm run backfill -- --from 903900 --to 903990
import { migrate, pool } from "@/lib/db/pool";
import { blockTimeLookup, processBlock } from "@/lib/detector/ingest";
import { ingestConfig } from "./config";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  await migrate();
  const cfg = ingestConfig();
  const log = cfg.log!;
  let heights: number[];
  if (arg("--heights")) heights = arg("--heights")!.split(",").map(Number);
  else if (arg("--from") && arg("--to")) {
    const from = Number(arg("--from")), to = Number(arg("--to"));
    heights = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  } else throw new Error("pass --heights a,b,c or --from N --to M");

  const timeFor = blockTimeLookup(cfg.rpc);
  let total = 0;
  for (const h of heights) {
    const hash = await cfg.rpc.blockHash(h);
    const t0 = Date.now();
    const { events } = await processBlock(cfg, hash, "archive", timeFor);
    total += events.length;
    log(`archive ${h}: ${events.length} ghost(s) in ${Date.now() - t0}ms ${events.map((e) => `${e.id}:${e.cohort}y+`).join(" ")}`);
  }
  log(`done: ${heights.length} block(s), ${total} event(s)`);
  await pool().end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
