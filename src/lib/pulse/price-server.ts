import { readCache, writeCache } from "@/lib/db/cache";
import { summarizePrices, type PriceHistory } from "./prices";

const MEMPOOL = (process.env.MEMPOOL_API ?? "https://mempool.space/api").replace(/\/$/, "");
const KEY = "prices:v1";
const TTL_MS = 6 * 3600_000;

const state = globalThis as unknown as { gwPrices?: { at: number; data: PriceHistory; inflight?: Promise<PriceHistory | null> } };

async function fetchHistory(): Promise<PriceHistory | null> {
  const res = await fetch(`${MEMPOOL}/v1/historical-price?currency=USD`, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  if (!res.ok) throw new Error(`price history: HTTP ${res.status}`);
  const j = (await res.json()) as { prices?: { time: number; USD: number }[] };
  return summarizePrices(j.prices ?? []);
}

/**
 * Bitcoin's daily price since July 2010, refreshed every 6 hours. The last good copy is
 * kept in the database so a restart or an outage at the source still has an answer.
 */
export async function getPriceHistory(): Promise<PriceHistory | null> {
  const c = state.gwPrices;
  if (c && Date.now() - c.at < TTL_MS) return c.data;
  try {
    const data = await fetchHistory();
    if (!data) throw new Error("empty price history");
    state.gwPrices = { at: Date.now(), data };
    void writeCache(KEY, data);
    return data;
  } catch {
    if (c) return c.data;
    const saved = await readCache<PriceHistory>(KEY);
    if (saved) {
      state.gwPrices = { at: Date.now() - TTL_MS + 15 * 60_000, data: saved.value }; // retry in ~15 minutes
      return saved.value;
    }
    return null;
  }
}
