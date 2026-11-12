import { rpcFromEnv } from "@/lib/detector/rpc";
import { priceOnDay } from "./prices";
import { getPriceHistory } from "./price-server";

/**
 * USD price of one bitcoin on a given day, from the price history the site already keeps
 * (no request per lookup). Null before the record starts in July 2010.
 */
export async function priceOn(unixSeconds: number): Promise<number | null> {
  const h = await getPriceHistory().catch(() => null);
  return priceOnDay(h, unixSeconds);
}

export interface BlockFacts {
  height: number;
  txCount: number;
  /** 0 to 1: block weight over the 4,000,000 weight-unit limit (size x 4 before SegWit). */
  fullness: number;
}

const blockCache = ((globalThis as unknown as { gwBlockFacts?: Map<number, BlockFacts | null> }).gwBlockFacts ??= new Map());

/** Size and transaction count of a past block, from the node, cached (blocks don't change). */
export async function blockAt(height: number): Promise<BlockFacts | null> {
  if (blockCache.has(height)) return blockCache.get(height)!;
  try {
    const s = await rpcFromEnv().call<{ txs: number; total_weight: number }>("getblockstats", [height, ["txs", "total_weight"]]);
    const facts = { height, txCount: s.txs, fullness: Math.min(1, s.total_weight / 4_000_000) };
    blockCache.set(height, facts);
    return facts;
  } catch {
    return null;
  }
}
