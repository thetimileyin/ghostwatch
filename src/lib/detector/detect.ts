import { cohortFor, yearsToSeconds } from "@/lib/domain/time";
import type { Cohort, GhostInput } from "@/lib/domain/types";

/** The subset of Bitcoin Core `getblock <hash> 3` that detection needs. */
export interface RpcBlock {
  hash: string;
  height: number;
  previousblockhash?: string;
  time: number;
  tx: RpcTx[];
}

export interface RpcTx {
  txid: string;
  vin: RpcVin[];
  vout: unknown[];
}

export interface RpcVin {
  coinbase?: string;
  txid?: string;
  vout?: number;
  prevout?: {
    generated?: boolean;
    height: number;
    value: number; // BTC, as returned by Core
    scriptPubKey?: { type?: string };
  };
}

export interface DetectedEvent {
  id: string;
  txid: string;
  blockHash: string;
  blockHeight: number;
  blockTime: number;
  dormantSats: number;
  dormantInputCount: number;
  totalInputCount: number;
  outputCount: number;
  oldestCreatedHeight: number;
  oldestCreatedTime: number;
  maxAgeSeconds: number;
  cohort: Cohort;
  inputs: GhostInput[];
}

export interface DetectOptions {
  /** Minimum dormancy in years. Defaults to 5. */
  minYears?: number;
  /** Header time for a block height. Called only for inputs that pass the height pre-filter. */
  timeForHeight: (height: number) => Promise<number>;
}

/**
 * Over any 5-year span the chain has produced well over 200k blocks, so inputs
 * created fewer blocks ago than this can't be 5 years old. It only saves header
 * lookups; the exact rule below uses block timestamps.
 */
const HEIGHT_PREFILTER_PER_YEAR = 40_000;

/** Converts a Core BTC float to integer sats without float drift. */
export function btcToSats(btc: number): number {
  return Math.round(btc * 1e8);
}

export function eventIdForTxid(txid: string): string {
  return txid.slice(0, 16);
}

/**
 * Finds transactions in a block that spend outputs which had been unspent for
 * at least `minYears`. Age is per output: spending block time minus the time of
 * the block that created the output. Mixed-age transactions report only the
 * qualifying inputs' value, but keep every input for transparency.
 */
export async function detectGhosts(block: RpcBlock, opts: DetectOptions): Promise<DetectedEvent[]> {
  const minYears = opts.minYears ?? 5;
  const minAge = yearsToSeconds(minYears);
  const minHeightGap = Math.floor(minYears * HEIGHT_PREFILTER_PER_YEAR);
  const events: DetectedEvent[] = [];

  for (const tx of block.tx) {
    if (tx.vin.some((v) => v.coinbase !== undefined)) continue;
    const candidates = tx.vin.filter((v) => v.prevout && block.height - v.prevout.height >= minHeightGap);
    if (candidates.length === 0) continue;

    const inputs: GhostInput[] = [];
    for (let i = 0; i < tx.vin.length; i++) {
      const v = tx.vin[i];
      if (!v.prevout || v.txid === undefined || v.vout === undefined) {
        throw new Error(`tx ${tx.txid} input ${i} has no prevout; getblock verbosity 3 is required`);
      }
      const isCandidate = block.height - v.prevout.height >= minHeightGap;
      const createdTime = isCandidate ? await opts.timeForHeight(v.prevout.height) : block.time;
      const age = block.time - createdTime;
      inputs.push({
        inputIndex: i,
        prevTxid: v.txid,
        prevVout: v.vout,
        createdHeight: v.prevout.height,
        // Young inputs aren't dated precisely (no header lookup); mark them by height only.
        createdTime: isCandidate ? createdTime : -1,
        valueSats: btcToSats(v.prevout.value),
        scriptType: v.prevout.scriptPubKey?.type ?? null,
        qualifies: isCandidate && age >= minAge,
      });
    }

    const qualifying = inputs.filter((i) => i.qualifies);
    if (qualifying.length === 0) continue;

    const oldest = qualifying.reduce((a, b) => (b.createdTime < a.createdTime ? b : a));
    const maxAge = block.time - oldest.createdTime;
    const cohort = cohortFor(maxAge);
    if (cohort === null) continue; // unreachable while minYears >= 5

    events.push({
      id: eventIdForTxid(tx.txid),
      txid: tx.txid,
      blockHash: block.hash,
      blockHeight: block.height,
      blockTime: block.time,
      dormantSats: qualifying.reduce((s, i) => s + i.valueSats, 0),
      dormantInputCount: qualifying.length,
      totalInputCount: inputs.length,
      outputCount: tx.vout.length,
      oldestCreatedHeight: oldest.createdHeight,
      oldestCreatedTime: oldest.createdTime,
      maxAgeSeconds: maxAge,
      cohort,
      inputs,
    });
  }
  return events;
}
