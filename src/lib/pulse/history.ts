const MEMPOOL = (process.env.MEMPOOL_API ?? "https://mempool.space/api").replace(/\/$/, "");
const TOLERANCE_S = 14 * 86400;

const cache = ((globalThis as unknown as { gwHistPrice?: Map<number, number | null> }).gwHistPrice ??= new Map());

/**
 * USD price of one bitcoin on a given day, fetched server-side. Returns null when there
 * is no honest answer: the source has no data that close to the date (it answers 2009
 * requests with a July 2010 zero) or the request fails.
 */
export async function priceOn(unixSeconds: number): Promise<number | null> {
  const day = Math.floor(unixSeconds / 86400) * 86400;
  if (cache.has(day)) return cache.get(day)!;
  try {
    const res = await fetch(`${MEMPOOL}/v1/historical-price?currency=USD&timestamp=${day}`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { prices?: { time: number; USD: number }[] };
    const p = j.prices?.[0];
    const v = p && p.USD > 0 && Math.abs(p.time - day) <= TOLERANCE_S ? p.USD : null;
    cache.set(day, v);
    return v;
  } catch {
    return null;
  }
}

export interface BlockFacts {
  height: number;
  txCount: number;
  /** 0 to 1: block weight over the 4,000,000 weight-unit limit (size x 4 before SegWit). */
  fullness: number;
}

const blockCache = ((globalThis as unknown as { gwBlockFacts?: Map<number, BlockFacts | null> }).gwBlockFacts ??= new Map());

/** Size and transaction count of a past block, looked up server-side and cached (blocks don't change). */
export async function blockAt(height: number): Promise<BlockFacts | null> {
  if (blockCache.has(height)) return blockCache.get(height)!;
  try {
    const hashRes = await fetch(`${MEMPOOL}/block-height/${height}`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!hashRes.ok) return null;
    const hash = (await hashRes.text()).trim();
    const res = await fetch(`${MEMPOOL}/block/${hash}`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    const b = (await res.json()) as { tx_count: number; weight: number };
    const facts = { height, txCount: b.tx_count, fullness: Math.min(1, b.weight / 4_000_000) };
    blockCache.set(height, facts);
    return facts;
  } catch {
    return null;
  }
}
