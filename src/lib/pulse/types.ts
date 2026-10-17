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
}

export interface NodesSnapshot {
  timestamp: number;
  totalNodes: number;
  /** [lat, lng] of nodes with a public location (Tor nodes have none). */
  points: [number, number][];
}
