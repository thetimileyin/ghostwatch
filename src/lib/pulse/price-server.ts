import { readCache, writeCache } from "@/lib/db/cache";
import { summarizePrices, type PriceHistory } from "./prices";
import { fromApi, fromMempool, mempoolUp } from "@/lib/sources";

const KEY = "prices:v1";
const TTL_MS = 6 * 3600_000;

const state = globalThis as unknown as { gwPrices?: { at: number; data: PriceHistory; inflight?: Promise<PriceHistory | null> } };

async function fetchHistory(saved: PriceHistory | null): Promise<PriceHistory | null> {
  // mempool.space has the full history since 2010.
  const full = mempoolUp() ? await fromMempool<{ prices?: { time: number; USD: number }[] }>("/v1/historical-price?currency=USD", 30_000) : null;
  if (full?.prices?.length) return summarizePrices(full.prices);
  // Otherwise: the saved history, brought up to date with Kraken's daily closes (last ~2 years).
  const kr = await fromApi<{ result?: Record<string, [number, string, string, string, string][] | number> }>("https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440", 15_000);
  const rows = kr?.result ? (Object.values(kr.result).find(Array.isArray) as [number, string, string, string, string][] | undefined) : undefined;
  if (!rows?.length) return null;
  const fresh = rows.map(([t, , , , close]) => ({ time: t, USD: Number(close) })).filter((p) => p.USD > 0);
  const firstFreshDay = Math.floor(fresh[0].time / 86400);
  const old = saved ? saved.days.map((d, i) => ({ time: d * 86400 + 43200, USD: saved.usd[i] })).filter((p) => Math.floor(p.time / 86400) < firstFreshDay) : [];
  return summarizePrices([...old, ...fresh]);
}

/**
 * Bitcoin's daily price since July 2010, refreshed every 6 hours. The last good copy is
 * kept in the database so a restart or an outage at the source still has an answer.
 */
export async function getPriceHistory(): Promise<PriceHistory | null> {
  const c = state.gwPrices;
  if (c && Date.now() - c.at < TTL_MS) return c.data;
  try {
    const saved = c?.data ?? (await readCache<PriceHistory>(KEY).catch(() => null))?.value ?? null;
    const data = await fetchHistory(saved);
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
