// Live network snapshot served by /api/pulse. Fetched server-side so a
// visitor's browser never talks to third parties (no IP leakage).

export interface PulseTx {
  txid: string;
  /** Total output value in sats (includes change; not "amount sent"). */
  value: number;
  fee: number;
  vsize: number;
  feeRate: number; // sat/vB
  /** Server time (ms) we first saw it in the recent-transactions sample. */
  seenAt: number;
}

export interface PulseBlock {
  height: number;
  hash: string;
  time: number; // unix s
  txCount: number;
  size: number;
  weight: number;
  totalFees: number; // sats
  medianFee: number; // sat/vB
  reward: number; // sats (subsidy + fees)
  pool: string | null;
  totalOutput: number | null; // sats
}

export interface PulseProjected {
  nTx: number;
  vsize: number;
  medianFee: number;
  minFee: number;
  maxFee: number;
  totalFees: number;
}

export interface PulseGhost {
  id: string;
  dormantSats: number;
  oldestCreatedTime: number;
  blockHeight: number;
  blockTime: number;
  cohort: 5 | 10 | 15;
  dormantInputCount: number;
}

/** Slower-moving context, refreshed every few minutes. */
export interface PulseNetwork {
  price24hAgo: number | null;
  hashrateEh: number | null; // exahashes per second
  difficulty: number | null;
  pools24h: { name: string; blocks: number; share: number }[];
  lightning: { channels: number; nodes: number; capacitySats: number; asOf: string } | null;
}

export interface Pulse {
  serverTime: number; // ms
  ok: boolean;
  priceUsd: number | null;
  network: PulseNetwork;
  fees: { fastest: number; halfHour: number; hour: number; economy: number; minimum: number } | null;
  mempool: { count: number; vsize: number; totalFee: number } | null;
  projected: PulseProjected[];
  blocks: PulseBlock[];
  /** Rolling sample of recently broadcast transactions, newest first. */
  txs: PulseTx[];
  ghosts: PulseGhost[];
  /** The last 24 hours of awakenings: the true totals and the most notable (10+ years, 1+ BTC), best first. */
  ghostDay?: { all: number; notable: number; top: PulseGhost[] };
  /** Tabs watching GhostWatch right now (anonymous count). Set by the API route. */
  watching?: number;
}

export interface NodesSnapshot {
  timestamp: number;
  totalNodes: number;
  /** [lat, lng] of nodes with a public location (Tor nodes have none). */
  points: [number, number][];
  /** Per-place counts (city or area). Absent when only coordinates are available. */
  places?: NodePlace[];
  summary?: NodeSummary;
}

/** A share of nodes: label and fraction 0 to 1. */
export interface NodeShare {
  label: string;
  share: number;
}

/**
 * Nodes grouped by place. Deliberately no addresses, hostnames or hosting providers:
 * GhostWatch shows places, not people.
 */
export interface NodePlace {
  lat: number;
  lng: number;
  /** "Near Frankfurt, DE" (nearest major city to the area's nodes), or a coordinate cell. */
  name: string;
  count: number;
  /** Fraction of all mapped nodes that are in this area. */
  share?: number;
  /** Software in this area, when the source publishes it per node (it no longer does). */
  versions?: NodeShare[];
  /** Fraction of these nodes at or within 2 blocks of the snapshot's best height, when known. */
  synced?: number;
}

export interface NodeSummary {
  total: number;
  /** Reachable only over Tor: no location, so never on the map. */
  tor: number;
  countries: NodeShare[];
  versions: NodeShare[];
  synced: number;
}
