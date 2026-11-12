import { readCache, writeCache } from "@/lib/db/cache";
import { ghostDay, listEvents } from "@/lib/db/read";
import type { GhostEvent } from "@/lib/domain/types";
import { aggregateNodes, type RawSnapshot } from "./nodes";
import { nodeAreas } from "@/lib/geo/areas";
import { getCoreRelease } from "./releases";
import { esploraJson, fromApi, fromMempool, mempoolUp } from "@/lib/sources";
import { rpcFromEnv } from "@/lib/detector/rpc";
import { WARM_BLOCKS, recentBlocksNow } from "./chain";
import type { NodesSnapshot, Pulse, PulseBlock, PulseNetwork, PulseTx } from "./types";

const NODES_URL = process.env.NODES_API ?? "https://btcnodes.io/api/v1/snapshots/latest/?field=coordinates";
// Full snapshot (software, height, city per node). Large and slow, so fetched in the background.
const NODES_FULL_URL = process.env.NODES_FULL_API ?? "https://btcnodes.io/api/v1/snapshots/latest/";
const PULSE_TTL_MS = 10_000; // shared by every viewer; each source has its own longer cache
const NODES_TTL_MS = 60 * 60 * 1000;
const TX_BUFFER = 160;

async function getJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

// Module-level state: one cached snapshot and a rolling tx sample per server process.
const state = globalThis as unknown as {
  gwPulse?: { at: number; data: Pulse; inflight?: Promise<Pulse> };
  gwTxs?: Map<string, PulseTx>;
  gwNodes?: { at: number; data: NodesSnapshot };
  gwNodesFull?: { at: number; inflight?: Promise<void> };
};

interface RawBlock {
  id: string; height: number; timestamp: number; tx_count: number; size: number; weight: number;
  extras?: { totalFees?: number; medianFee?: number; reward?: number; totalOutputAmt?: number; pool?: { name?: string } };
}

/** Per-key TTL cache for slow-moving data; serves the last good value on failure. */
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
  const store = ((globalThis as unknown as { gwSlow?: Map<string, { at: number; v: T }> }).gwSlow ??= new Map());
  const hit = store.get(key) as { at: number; v: T } | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return hit.v;
  try {
    const v = await fn();
    store.set(key, { at: Date.now(), v });
    return v;
  } catch {
    return hit?.v ?? null;
  }
}

// Price: Coinbase's public 24h stats first (price and true 24-hour open in one call),
// then mempool.space, then Kraken.
async function spotPrice(): Promise<{ usd: number; open24: number | null } | null> {
  const cb = await fromApi<{ last: string; open: string }>("https://api.exchange.coinbase.com/products/BTC-USD/stats");
  if (cb && Number(cb.last) > 0) return { usd: Number(cb.last), open24: Number(cb.open) || null };
  const mp = mempoolUp() ? await fromMempool<{ USD: number }>("/v1/prices") : null;
  if (mp?.USD) return { usd: mp.USD, open24: null };
  const kr = await fromApi<{ result?: Record<string, { c: string[] }> }>("https://api.kraken.com/0/public/Ticker?pair=XBTUSD");
  const k = kr?.result && Object.values(kr.result)[0]?.c?.[0];
  return k ? { usd: Number(k), open24: null } : null;
}

type Fees = { fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number; minimumFee: number };

// Fee estimates: mempool.space's recommendation when it answers, else Esplora's estimates.
async function feeEstimates(): Promise<Fees | null> {
  if (mempoolUp()) {
    const f = await fromMempool<Fees>("/v1/fees/recommended");
    if (f) return f;
  }
  const e = await esploraJson<Record<string, number>>("/fee-estimates");
  if (!e) return null;
  const r = (x: number | undefined) => Math.max(0.1, Math.round((x ?? 1) * 10) / 10);
  return { fastestFee: r(e["1"]), halfHourFee: r(e["3"]), hourFee: r(e["6"]), economyFee: r(e["144"]), minimumFee: r(e["1008"] ?? e["144"]) };
}

type EsploraMempool = { count: number; vsize: number; total_fee: number; fee_histogram?: [number, number][] };
type Projected = Pulse["projected"];

/**
 * The next few blocks, estimated from the mempool's fee histogram (highest-paying first,
 * 1,000,000 vB per block). Used when mempool.space's own projection isn't available.
 */
export function projectFromHistogram(m: EsploraMempool | null): Projected {
  const h = m?.fee_histogram;
  if (!m || !h?.length) return [];
  const perVb = m.count && m.vsize ? m.count / m.vsize : 0;
  const out: Projected = [];
  let cur = { vsize: 0, fees: 0, max: h[0][0], min: h[0][0], median: h[0][0] };
  for (const [rate, vsize] of h) {
    let left = vsize;
    while (left > 0 && out.length < 6) {
      const take = Math.min(left, 1_000_000 - cur.vsize);
      if (cur.vsize < 500_000 && cur.vsize + take >= 500_000) cur.median = rate;
      cur.vsize += take;
      cur.fees += take * rate;
      cur.min = rate;
      left -= take;
      if (cur.vsize >= 1_000_000) {
        out.push({ nTx: Math.round(cur.vsize * perVb), vsize: cur.vsize, medianFee: cur.median, minFee: cur.min, maxFee: cur.max, totalFees: Math.round(cur.fees) });
        cur = { vsize: 0, fees: 0, max: rate, min: rate, median: rate };
      }
    }
    if (out.length >= 6) break;
  }
  if (cur.vsize > 0 && out.length < 6) out.push({ nTx: Math.round(cur.vsize * perVb), vsize: cur.vsize, medianFee: cur.median, minFee: cur.min, maxFee: cur.max, totalFees: Math.round(cur.fees) });
  return out;
}

/** Keep the last good value when a source returns nothing (cached() keeps it on throws). */
const orThrow = <T,>(v: T | null): T => {
  if (v == null) throw new Error("no data");
  return v;
};

async function network(spot: { usd: number; open24: number | null } | null): Promise<PulseNetwork> {
  const [hr, ln, past] = await Promise.all([
    cached("hashrate", 10 * 60_000, async () => {
      const [hps, diff] = await rpcFromEnv().batch<number>([["getnetworkhashps", [144]], ["getdifficulty", []]]);
      return { eh: hps / 1e18, difficulty: diff };
    }),
    cached("lightning", 60 * 60_000, async () => orThrow(mempoolUp() ? await fromMempool<{ latest: { channel_count: number; node_count: number; total_capacity: number; added: string } }>("/v1/lightning/statistics/latest") : null)),
    spot?.open24 ? Promise.resolve(spot.open24) : cached("price24h", 10 * 60_000, async () => {
      const r = orThrow(mempoolUp() ? await fromMempool<{ prices: { USD: number }[] }>(`/v1/historical-price?currency=USD&timestamp=${Math.floor(Date.now() / 1000) - 86400}`) : null);
      return r.prices[0]?.USD ?? null;
    }),
  ]);
  // Who's mining: counted from the last day of blocks read from the node (coinbase tags).
  const day = recentBlocksNow(WARM_BLOCKS).filter((b) => b.time >= Date.now() / 1000 - 86_400);
  const counts = new Map<string, number>();
  for (const b of day) if (b.pool) counts.set(b.pool, (counts.get(b.pool) ?? 0) + 1);
  const total = day.length;
  const pools24h = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, blocks]) => ({ name, blocks, share: total ? blocks / total : 0 }));
  return {
    price24hAgo: past ?? null,
    hashrateEh: hr?.eh ?? null,
    difficulty: hr?.difficulty ?? null,
    pools24h: total >= 20 ? pools24h : [], // wait for enough blocks before showing shares
    lightning: ln ? { channels: ln.latest.channel_count, nodes: ln.latest.node_count, capacitySats: ln.latest.total_capacity, asOf: ln.latest.added } : null,
  };
}

async function build(): Promise<Pulse> {
  const [spot, fees, mem, recent] = await Promise.all([
    cached("spot", 30_000, async () => orThrow(await spotPrice())),
    cached("fees", 30_000, async () => orThrow(await feeEstimates())),
    cached("mempool", 20_000, async () => orThrow(await esploraJson<EsploraMempool>("/mempool"))),
    cached("recent", 10_000, async () => orThrow(await esploraJson<{ txid: string; fee: number; vsize: number; value: number }[]>("/mempool/recent"))),
  ]);
  const proj = await cached("projected", 30_000, async () => {
    const p = mempoolUp() ? await fromMempool<{ nTx: number; blockVSize: number; medianFee: number; feeRange: number[]; totalFees: number }[]>("/v1/fees/mempool-blocks") : null;
    if (p?.length)
      return p.slice(0, 6).map((b) => ({ nTx: b.nTx, vsize: b.blockVSize, medianFee: b.medianFee, minFee: b.feeRange[0] ?? 0, maxFee: b.feeRange[b.feeRange.length - 1] ?? 0, totalFees: b.totalFees }));
    return orThrow(projectFromHistogram(mem).length ? projectFromHistogram(mem) : null);
  });

  const now = Date.now();
  const buf = (state.gwTxs ??= new Map());
  for (const t of recent ?? []) {
    if (!buf.has(t.txid)) buf.set(t.txid, { txid: t.txid, value: t.value, fee: t.fee, vsize: t.vsize, feeRate: t.vsize ? t.fee / t.vsize : 0, seenAt: now });
  }
  while (buf.size > TX_BUFFER) buf.delete(buf.keys().next().value!);
  // A sample that's gone stale (source unreachable) isn't "passing through" anymore.
  const freshTxs = [...buf.values()].filter((t) => now - t.seenAt < 10 * 60_000).sort((a, b) => b.seenAt - a.seenAt);

  const blocks = recentBlocksNow(10);

  let ghosts: Pulse["ghosts"] = [];
  let ghostDayData: Pulse["ghostDay"];
  const toGhost = (e: GhostEvent) => ({
    id: e.id, dormantSats: e.dormantSats, oldestCreatedTime: e.oldestCreatedTime, blockHeight: e.blockHeight,
    blockTime: e.blockTime, cohort: e.cohort, dormantInputCount: e.dormantInputCount,
  });
  try {
    ghosts = (await listEvents("live", { limit: 12, minCohort: 5 })).map(toGhost);
    const day = await ghostDay(Math.floor(now / 1000) - 86_400);
    ghostDayData = { all: day.all, notable: day.notable, top: day.top.map(toGhost) };
  } catch {
    /* detector DB down: the network view still works */
  }

  return {
    serverTime: now,
    ok: Boolean(spot || fees || mem || blocks.length),
    priceUsd: spot?.usd ?? null,
    network: await network(spot),
    fees: fees ? { fastest: fees.fastestFee, halfHour: fees.halfHourFee, hour: fees.hourFee, economy: fees.economyFee, minimum: fees.minimumFee } : null,
    mempool: mem ? { count: mem.count, vsize: mem.vsize, totalFee: mem.total_fee } : null,
    projected: proj ?? [],
    blocks,
    txs: freshTxs,
    ghosts,
    ghostDay: ghostDayData,
    release: await getCoreRelease().catch(() => null),
  };
}

/** Shared snapshot, refreshed at most every few seconds no matter how many viewers. */
export async function getPulse(): Promise<Pulse> {
  const c = state.gwPulse;
  if (c && Date.now() - c.at < PULSE_TTL_MS) return c.data;
  if (c?.inflight) return c.inflight;
  const inflight = build().then((data) => {
    state.gwPulse = { at: Date.now(), data };
    return data;
  });
  state.gwPulse = c ? { ...c, inflight } : { at: 0, data: undefined as unknown as Pulse, inflight };
  try {
    return await inflight;
  } finally {
    if (state.gwPulse) delete state.gwPulse.inflight;
  }
}

const NODES_KEY = "nodes:v1";

/**
 * Node locations, plus per-place details when the full snapshot has arrived.
 * Locations come first (small, quick); the full snapshot is fetched in the background
 * at most once an hour and replaces them when it lands. Only aggregates are kept.
 * Every good snapshot is saved to the database, so a restart or an outage at the
 * source falls back to the last known nodes instead of an empty map.
 */
export async function getNodes(): Promise<NodesSnapshot | null> {
  const c = state.gwNodes;
  refreshFullNodes();
  if (c && c.data.points.length > 0 && Date.now() - c.at < NODES_TTL_MS) return c.data;
  try {
    const raw = await getJson<{ timestamp: number; total_nodes: number; coordinates: [number, number][] }>(NODES_URL, 15000);
    const points = raw.coordinates;
    const data: NodesSnapshot = { timestamp: raw.timestamp, totalNodes: raw.total_nodes, points, places: nodeAreas(points) };
    // Keep any network summary we already have; refresh the map points and areas.
    const prev = state.gwNodes?.data;
    const merged: NodesSnapshot = prev?.summary ? { ...data, summary: prev.summary } : data;
    state.gwNodes = { at: Date.now(), data: merged };
    void writeCache(NODES_KEY, merged);
    return merged;
  } catch {
    if (c) return c.data;
    // Source down and nothing in memory (e.g. just restarted): use the last saved snapshot.
    const saved = await readCache<NodesSnapshot>(NODES_KEY);
    if (saved) {
      // Treat it as fresh enough to stop hammering the source; the background refresh still runs.
      state.gwNodes = { at: Date.now() - NODES_TTL_MS + 10 * 60_000, data: saved.value };
      return saved.value;
    }
    return null;
  }
}

function refreshFullNodes() {
  const f = (state.gwNodesFull ??= { at: 0 });
  if (f.inflight || Date.now() - f.at < NODES_TTL_MS) return;
  f.at = Date.now();
  f.inflight = getJson<RawSnapshot>(NODES_FULL_URL, 120_000)
    .then((raw) => {
      if (raw?.nodes && Object.keys(raw.nodes).length > 0) {
        const full = aggregateNodes(raw);
        // The source stopped publishing locations in the full snapshot (late 2026): keep the
        // map points from the coordinates feed and take only what the full snapshot really has.
        const prev = state.gwNodes?.data;
        const data: NodesSnapshot =
          full.points.length > 0 ? full : { ...(prev ?? full), totalNodes: full.totalNodes, summary: full.summary, places: prev?.places ?? nodeAreas(prev?.points ?? []) };
        if (data.points.length === 0 && !prev) return; // nothing to draw yet; don't cache an empty map
        state.gwNodes = { at: Date.now(), data };
        void writeCache(NODES_KEY, data);
      }
    })
    .catch(() => {
      f.at = Date.now() - NODES_TTL_MS + 10 * 60_000; // try again in about 10 minutes
    })
    .finally(() => {
      delete f.inflight;
    });
}

/**
 * The last ~24 hours of blocks (about 144), for the observatory dial. Filled once
 * by paging backwards 15 blocks at a time, then topped up from the latest list.
 */
export async function getDayOfBlocks(): Promise<PulseBlock[]> {
  // From the node (see chain.ts): whatever has been read so far, newest first; the rest loads in the background.
  return recentBlocksNow(WARM_BLOCKS).filter((b) => b.time >= Date.now() / 1000 - 26 * 3600);
}
