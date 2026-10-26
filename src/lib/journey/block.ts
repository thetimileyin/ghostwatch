import { eventsInBlock, getStatus } from "@/lib/db/read";
import { rpcFromEnv } from "@/lib/detector/rpc";
import type { GhostEvent } from "@/lib/domain/types";
import { MEMPOOL, cached, getJson } from "./fetch";

export interface BlockStory {
  height: number;
  hash: string;
  time: number;
  /** Seconds since the block before it, or null for the genesis block. */
  sincePrevious: number | null;
  txCount: number;
  /** 0 to 1 of the 4,000,000 weight-unit limit. */
  fullness: number;
  sizeBytes: number | null;
  pool: string | null;
  /** sat/vB: cheapest, typical (median) and highest paid in the block. */
  fees: { low: number; typical: number; high: number } | null;
  totalFeesSats: number | null;
  rewardSats: number | null;
  coinbaseTxid: string | null;
  confirmations: number;
  previousHash: string | null;
  nextHash: string | null;
  awakenings: GhostEvent[];
  /** Highest block the detector has checked, to say honestly whether we watched this one. */
  checkedTo: number | null;
}

export type BlockResult = { kind: "ok"; block: BlockStory } | { kind: "not-found" } | { kind: "invalid" } | { kind: "error" };

const isHeight = (s: string) => /^\d{1,7}$/.test(s);
const isHash = (s: string) => /^[0-9a-f]{64}$/i.test(s);

/** A block by height or hash. Kept 10 minutes once it has a few blocks on top, 30 seconds before that. */
export async function getBlockStory(input: string): Promise<BlockResult> {
  const id = input.trim().toLowerCase();
  if (!isHeight(id) && !isHash(id)) return { kind: "invalid" };
  return cached(`block:${id}`, () => load(id), (v) => (v.kind === "ok" ? (v.block.confirmations > 6 ? 10 * 60_000 : 30_000) : v.kind === "not-found" ? 60_000 : 0));
}

type Header = { hash: string; height: number; time: number; nTx: number; confirmations: number; previousblockhash?: string; nextblockhash?: string };

async function load(id: string): Promise<BlockResult> {
  const rpc = rpcFromEnv();
  let header: Header;
  try {
    const hash = isHeight(id) ? await rpc.call<string>("getblockhash", [Number(id)]) : id;
    header = await rpc.call<Header>("getblockheader", [hash]);
  } catch (err) {
    return /out of range|not found|no such/i.test(String((err as Error)?.message ?? err)) ? { kind: "not-found" } : { kind: "error" };
  }
  try {
    type MBlock = { size: number; weight: number; extras?: { pool?: { name?: string }; medianFee?: number; feeRange?: number[]; totalFees?: number; reward?: number } };
    const [prev, mb, coinbase, awakenings, status] = await Promise.all([
      header.previousblockhash ? rpc.call<{ time: number }>("getblockheader", [header.previousblockhash]).catch(() => null) : null,
      getJson<MBlock>(`${MEMPOOL}/v1/block/${header.hash}`),
      fetch(`${MEMPOOL}/block/${header.hash}/txid/0`, { signal: AbortSignal.timeout(8000), cache: "no-store" })
        .then((r) => (r.ok ? r.text() : null))
        .catch(() => null),
      eventsInBlock(header.height).catch(() => []),
      getStatus().catch(() => null),
    ]);
    const fr = mb?.extras?.feeRange;
    return {
      kind: "ok",
      block: {
        height: header.height,
        hash: header.hash,
        time: header.time,
        sincePrevious: prev ? header.time - prev.time : null,
        txCount: header.nTx,
        fullness: mb ? Math.min(1, mb.weight / 4_000_000) : 0,
        sizeBytes: mb?.size ?? null,
        pool: mb?.extras?.pool?.name && mb.extras.pool.name !== "Unknown" ? mb.extras.pool.name : null,
        fees: fr && fr.length ? { low: fr[0], typical: mb?.extras?.medianFee ?? fr[Math.floor(fr.length / 2)], high: fr[fr.length - 1] } : null,
        totalFeesSats: mb?.extras?.totalFees ?? null,
        rewardSats: mb?.extras?.reward ?? null,
        coinbaseTxid: coinbase && /^[0-9a-f]{64}$/.test(coinbase.trim()) ? coinbase.trim() : null,
        confirmations: header.confirmations,
        previousHash: header.previousblockhash ?? null,
        nextHash: header.nextblockhash ?? null,
        awakenings,
        checkedTo: status?.lastProcessedHeight ?? null,
      },
    };
  } catch {
    return { kind: "error" };
  }
}
