import { eventsInBlock, getStatus } from "@/lib/db/read";
import { rpcFromEnv } from "@/lib/detector/rpc";
import type { GhostEvent } from "@/lib/domain/types";
import { cached } from "./fetch";
import { poolFromCoinbase } from "@/lib/pulse/chain";

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
    // Everything from the node: stats (fees, size, reward) and the coinbase (pool tag, reward txid).
    type St = { feerate_percentiles: number[]; minfeerate: number; maxfeerate: number; totalfee: number; subsidy: number; total_size: number; total_weight: number };
    const [prev, st, head, awakenings, status] = await Promise.all([
      header.previousblockhash ? rpc.call<{ time: number }>("getblockheader", [header.previousblockhash]).catch(() => null) : null,
      rpc.call<St>("getblockstats", [header.hash, ["feerate_percentiles", "minfeerate", "maxfeerate", "totalfee", "subsidy", "total_size", "total_weight"]]).catch(() => null),
      rpc.call<{ tx: string[] }>("getblock", [header.hash, 1]).catch(() => null),
      eventsInBlock(header.height).catch(() => []),
      getStatus().catch(() => null),
    ]);
    const coinbaseTxid = head?.tx?.[0] ?? null;
    const cb = coinbaseTxid ? await rpc.call<{ vin: { coinbase?: string }[] }>("getrawtransaction", [coinbaseTxid, 1, header.hash]).catch(() => null) : null;
    const p = st?.feerate_percentiles;
    const precise = st && st.total_weight ? st.totalfee / (st.total_weight / 4) : 0;
    return {
      kind: "ok",
      block: {
        height: header.height,
        hash: header.hash,
        time: header.time,
        sincePrevious: prev ? header.time - prev.time : null,
        txCount: header.nTx,
        fullness: st ? Math.min(1, st.total_weight / 4_000_000) : 0,
        sizeBytes: st?.total_size ?? null,
        pool: cb?.vin?.[0]?.coinbase ? poolFromCoinbase(cb.vin[0].coinbase) : null,
        // The node rounds rates down to whole sat/vB; a typical rate under 1 reads 0, so use the average then.
        fees: st && header.nTx > 1 ? { low: st.minfeerate, typical: p?.[2] || precise, high: st.maxfeerate } : null,
        totalFeesSats: st?.totalfee ?? null,
        rewardSats: st ? st.subsidy + st.totalfee : null,
        coinbaseTxid,
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
