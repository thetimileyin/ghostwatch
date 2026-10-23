import { readCache, writeCache } from "@/lib/db/cache";
import { listEvents } from "@/lib/db/read";
import { aggregateNodes, type RawSnapshot } from "./nodes";
import type { NodesSnapshot, Pulse, PulseBlock, PulseNetwork, PulseTx } from "./types";

const MEMPOOL = (process.env.MEMPOOL_API ?? "https://mempool.space/api").replace(/\/$/, "");
const NODES_URL = process.env.NODES_API ?? "https://btcnodes.io/api/v1/snapshots/latest/?field=coordinates";
// Full snapshot (software, height, city per node). Large and slow, so fetched in the background.
const NODES_FULL_URL = process.env.NODES_FULL_API ?? "https://btcnodes.io/api/v1/snapshots/latest/";
const PULSE_TTL_MS = 4000;
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

async function network(): Promise<PulseNetwork> {
  const [past, hr, pools, ln] = await Promise.all([
    cached("price24h", 10 * 60_000, async () => {
      const r = await getJson<{ prices: { USD: number }[] }>(`${MEMPOOL}/v1/historical-price?currency=USD&timestamp=${Math.floor(Date.now() / 1000) - 86400}`);
      return r.prices[0]?.USD ?? null;
    }),
    cached("hashrate", 10 * 60_000, () => getJson<{ currentHashrate: number; currentDifficulty: number }>(`${MEMPOOL}/v1/mining/hashrate/3d`)),
    cached("pools24h", 10 * 60_000, () => getJson<{ pools: { name: string; blockCount: number }[] }>(`${MEMPOOL}/v1/mining/pools/24h`)),
    cached("lightning", 60 * 60_000, () => getJson<{ latest: { channel_count: number; node_count: number; total_capacity: number; added: string } }>(`${MEMPOOL}/v1/lightning/statistics/latest`)),
  ]);
  const total = pools?.pools.reduce((s, p) => s + p.blockCount, 0) ?? 0;
  return {
    price24hAgo: past ?? null,
    hashrateEh: hr ? hr.currentHashrate / 1e18 : null,
    difficulty: hr?.currentDifficulty ?? null,
    pools24h: (pools?.pools ?? []).slice(0, 8).map((p) => ({ name: p.name, blocks: p.blockCount, share: total ? p.blockCount / total : 0 })),
    lightning: ln ? { channels: ln.latest.channel_count, nodes: ln.latest.node_count, capacitySats: ln.latest.total_capacity, asOf: ln.latest.added } : null,
  };
}

async function build(): Promise<Pulse> {
  // Warm the 24h block history in the background so the dial has data on first view.
  if (!(globalThis as unknown as { gwHistory?: Map<number, unknown> }).gwHistory) void getDayOfBlocks().catch(() => {});
  const settled = await Promise.allSettled([
    getJson<{ USD: number }>(`${MEMPOOL}/v1/prices`),
    getJson<{ fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number; minimumFee: number }>(`${MEMPOOL}/v1/fees/recommended`),
    getJson<{ count: number; vsize: number; total_fee: number }>(`${MEMPOOL}/mempool`),
    getJson<{ nTx: number; blockVSize: number; medianFee: number; feeRange: number[]; totalFees: number }[]>(`${MEMPOOL}/v1/fees/mempool-blocks`),
    getJson<RawBlock[]>(`${MEMPOOL}/v1/blocks`),
    getJson<{ txid: string; fee: number; vsize: number; value: number }[]>(`${MEMPOOL}/mempool/recent`),
  ]);
  const val = <T,>(i: number) => (settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<T>).value : null);

  const now = Date.now();
  const buf = (state.gwTxs ??= new Map());
  for (const t of val<{ txid: string; fee: number; vsize: number; value: number }[]>(5) ?? []) {
    if (!buf.has(t.txid)) buf.set(t.txid, { txid: t.txid, value: t.value, fee: t.fee, vsize: t.vsize, feeRate: t.vsize ? t.fee / t.vsize : 0, seenAt: now });
  }
  while (buf.size > TX_BUFFER) buf.delete(buf.keys().next().value!);

  const prices = val<{ USD: number }>(0);
  const fees = val<{ fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number; minimumFee: number }>(1);
  const mem = val<{ count: number; vsize: number; total_fee: number }>(2);
  const proj = val<{ nTx: number; blockVSize: number; medianFee: number; feeRange: number[]; totalFees: number }[]>(3) ?? [];
  const blocks = (val<RawBlock[]>(4) ?? []).map(
    (b): PulseBlock => ({
      height: b.height, hash: b.id, time: b.timestamp, txCount: b.tx_count, size: b.size, weight: b.weight,
      totalFees: b.extras?.totalFees ?? 0, medianFee: b.extras?.medianFee ?? 0, reward: b.extras?.reward ?? 0,
      pool: b.extras?.pool?.name ?? null, totalOutput: b.extras?.totalOutputAmt ?? null,
    }),
  );

  let ghosts: Pulse["ghosts"] = [];
  try {
    ghosts = (await listEvents("live", { limit: 12, minCohort: 5 })).map((e) => ({
      id: e.id, dormantSats: e.dormantSats, oldestCreatedTime: e.oldestCreatedTime, blockHeight: e.blockHeight,
      blockTime: e.blockTime, cohort: e.cohort, dormantInputCount: e.dormantInputCount,
    }));
  } catch {
    /* detector DB down: the network view still works */
  }

  return {
    serverTime: now,
    ok: settled.slice(0, 6).some((s) => s.status === "fulfilled"),
    priceUsd: prices?.USD ?? null,
    network: await network(),
    fees: fees ? { fastest: fees.fastestFee, halfHour: fees.halfHourFee, hour: fees.hourFee, economy: fees.economyFee, minimum: fees.minimumFee } : null,
    mempool: mem ? { count: mem.count, vsize: mem.vsize, totalFee: mem.total_fee } : null,
    projected: proj.slice(0, 6).map((p) => ({
      nTx: p.nTx, vsize: p.blockVSize, medianFee: p.medianFee, minFee: p.feeRange[0] ?? 0, maxFee: p.feeRange[p.feeRange.length - 1] ?? 0, totalFees: p.totalFees,
    })),
    blocks,
    txs: [...buf.values()].sort((a, b) => b.seenAt - a.seenAt),
    ghosts,
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
  if (c && (Date.now() - c.at < NODES_TTL_MS || c.data.places)) return c.data;
  try {
    const raw = await getJson<{ timestamp: number; total_nodes: number; coordinates: [number, number][] }>(NODES_URL, 15000);
    const data: NodesSnapshot = { timestamp: raw.timestamp, totalNodes: raw.total_nodes, points: raw.coordinates };
    // Don't replace a detailed snapshot with a bare one.
    if (!state.gwNodes?.data.places) {
      state.gwNodes = { at: Date.now(), data };
      void writeCache(NODES_KEY, data);
    }
    return state.gwNodes?.data ?? data;
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
        const data = aggregateNodes(raw);
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
  const g = globalThis as unknown as { gwHistory?: Map<number, PulseBlock>; gwHistoryAt?: number };
  const hist = (g.gwHistory ??= new Map());
  if (g.gwHistoryAt && Date.now() - g.gwHistoryAt < 30_000 && hist.size > 0) return [...hist.values()].sort((a, b) => b.height - a.height);
  const toBlock = (b: RawBlock): PulseBlock => ({
    height: b.height, hash: b.id, time: b.timestamp, txCount: b.tx_count, size: b.size, weight: b.weight,
    totalFees: b.extras?.totalFees ?? 0, medianFee: b.extras?.medianFee ?? 0, reward: b.extras?.reward ?? 0,
    pool: b.extras?.pool?.name ?? null, totalOutput: b.extras?.totalOutputAmt ?? null,
  });
  const latest = await getJson<RawBlock[]>(`${MEMPOOL}/v1/blocks`);
  latest.forEach((b) => hist.set(b.height, toBlock(b)));
  const tip = latest[0]?.height ?? 0;
  const cutoff = Date.now() / 1000 - 26 * 3600;
  let cursor = Math.min(...hist.keys()) - 1;
  for (let i = 0; i < 12 && cursor > 0; i++) {
    const oldest = hist.get(cursor + 1);
    if (oldest && oldest.time < cutoff) break;
    if (hist.has(cursor)) { cursor -= 15; continue; }
    const page = await getJson<RawBlock[]>(`${MEMPOOL}/v1/blocks/${cursor}`);
    page.forEach((b) => hist.set(b.height, toBlock(b)));
    cursor = Math.min(...page.map((b) => b.height)) - 1;
  }
  for (const h of hist.keys()) if (h < tip - 200) hist.delete(h);
  g.gwHistoryAt = Date.now();
  return [...hist.values()].sort((a, b) => b.height - a.height);
}
