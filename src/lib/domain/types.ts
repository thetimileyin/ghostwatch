// Shared shapes between the detector, the database and the UI.
// Amounts are integer satoshis; times are unix seconds taken from block headers.

export type Cohort = 5 | 10 | 15;
export type EventOrigin = "live" | "archive";
export type EventStatus = "confirmed" | "reversed";

export interface GhostInput {
  inputIndex: number;
  prevTxid: string;
  prevVout: number;
  createdHeight: number;
  createdTime: number;
  valueSats: number;
  scriptType: string | null;
  /** True when this output had been unspent for at least the dormancy threshold. */
  qualifies: boolean;
}

export interface GhostEvent {
  id: string;
  txid: string;
  blockHash: string;
  blockHeight: number;
  blockTime: number;
  dormantSats: number;
  dormantInputCount: number;
  totalInputCount: number;
  outputCount: number;
  oldestCreatedHeight: number;
  oldestCreatedTime: number;
  maxAgeSeconds: number;
  cohort: Cohort;
  origin: EventOrigin;
  status: EventStatus;
  detectedAt: string;
}

export interface GhostEventDetail extends GhostEvent {
  inputs: GhostInput[];
  history: { fromStatus: EventStatus | null; toStatus: EventStatus; blockHash: string; note: string | null; at: string }[];
}

/**
 * live: worker polled recently and is caught up.
 * delayed: worker is alive but behind, or hasn't polled for a while.
 * stopped: no heartbeat for a long time; data must be treated as stale.
 * unknown: no worker has ever reported (e.g. a fresh deployment).
 */
export type FeedState = "live" | "delayed" | "stopped" | "unknown";

export interface FeedStatus {
  state: FeedState;
  lastProcessedHeight: number | null;
  lastProcessedHash: string | null;
  observedTip: number | null;
  heartbeatAt: string | null;
  /** Seconds since the last heartbeat at the time the status was read. */
  heartbeatAgeSeconds: number | null;
  lastError: string | null;
  /** Height of the most recent live (non-archive) event, if any. */
  lastLiveEventHeight: number | null;
  serverTime: string;
}

export interface FeedStats {
  liveEvents: number;
  archiveEvents: number;
  largestDormantSats: number | null;
  longestAgeSeconds: number | null;
}

export interface FeedPayload {
  status: FeedStatus;
  stats: FeedStats;
  events: GhostEvent[];
  archive: GhostEvent[];
}
