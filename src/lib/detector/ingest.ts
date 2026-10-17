import { cacheBlockTime, cachedBlockTime, commitBlock, getCheckpoint, heartbeat, mainBlockAt, rollbackTo } from "@/lib/db/store";
import { LIVE_WORKER } from "@/lib/db/constants";
import type { EventOrigin } from "@/lib/domain/types";
import { detectGhosts, type DetectedEvent } from "./detect";
import type { BitcoinRpc } from "./rpc";

export { LIVE_WORKER };

export interface IngestConfig {
  rpc: BitcoinRpc;
  minYears: number;
  /** Channels that should announce an event; empty means "store only". */
  channelsFor: (e: DetectedEvent) => string[];
  log?: (msg: string) => void;
}

export function blockTimeLookup(rpc: BitcoinRpc) {
  const memo = new Map<number, number>();
  return async (height: number): Promise<number> => {
    const hit = memo.get(height) ?? (await cachedBlockTime(height));
    if (hit != null) {
      memo.set(height, hit);
      return hit;
    }
    const hash = await rpc.blockHash(height);
    const { time } = await rpc.header(hash);
    memo.set(height, time);
    await cacheBlockTime(height, hash, time);
    return time;
  };
}

/** Fetch, detect and persist one block. Returns the events found. */
export async function processBlock(cfg: IngestConfig, hash: string, origin: EventOrigin, timeFor = blockTimeLookup(cfg.rpc)) {
  const block = await cfg.rpc.blockWithPrevouts(hash);
  const events = await detectGhosts(block, { minYears: cfg.minYears, timeForHeight: timeFor });
  await commitBlock(
    LIVE_WORKER,
    { hash: block.hash, height: block.height, parentHash: block.previousblockhash ?? "", time: block.time },
    events,
    origin,
    origin === "live" ? cfg.channelsFor : () => [],
  );
  return { block, events };
}

/**
 * One live sync pass: detect reorgs against the stored chain, then process
 * every new block up to the tip. Safe to call repeatedly; progress is
 * checkpointed per block, so a crash resumes without skipping or duplicating.
 */
export async function syncOnce(cfg: IngestConfig, opts: { startHeight?: number; maxBlocks?: number } = {}) {
  const log = cfg.log ?? (() => {});
  const tip = await cfg.rpc.tipHeight();
  await heartbeat(LIVE_WORKER, tip);

  const cp = await getCheckpoint(LIVE_WORKER);
  let height = cp?.lastHeight ?? (opts.startHeight ?? tip) - 1;

  // Reorg check: walk back while our stored block at `height` is no longer on the main chain.
  if (cp?.lastHeight != null) {
    let probe = cp.lastHeight;
    while (probe > 0) {
      const stored = await mainBlockAt(probe);
      if (!stored) break;
      const chainHash = await cfg.rpc.blockHash(probe);
      if (chainHash === stored.hash) break;
      probe -= 1;
    }
    if (probe < cp.lastHeight) {
      const forkHash = await cfg.rpc.blockHash(probe);
      const reversed = await rollbackTo(LIVE_WORKER, probe, forkHash);
      log(`reorg: rolled back to ${probe}; reversed ${reversed.length} event(s)`);
      height = probe;
    }
  }

  const timeFor = blockTimeLookup(cfg.rpc);
  let processed = 0;
  while (height < tip && processed < (opts.maxBlocks ?? Infinity)) {
    const next = height + 1;
    const hash = await cfg.rpc.blockHash(next);
    // The chain moved under us mid-pass; stop and let the next pass run the reorg check.
    const prevStored = await mainBlockAt(height);
    if (prevStored && (await cfg.rpc.header(hash)).previousblockhash !== prevStored.hash) {
      log(`block ${next} does not extend ${prevStored.hash.slice(0, 12)}; deferring to reorg check`);
      break;
    }
    const t0 = Date.now();
    const { events } = await processBlock(cfg, hash, "live", timeFor);
    log(`block ${next}: ${events.length} ghost(s) in ${Date.now() - t0}ms`);
    height = next;
    processed += 1;
  }
  return { tip, height, processed };
}
