import { LIVE_WORKER } from "./constants";
import type { Cohort, FeedPayload, FeedStats, FeedStatus, GhostEvent, GhostEventDetail } from "@/lib/domain/types";
import { classify } from "@/lib/domain/freshness";
import { pool } from "./pool";

// Read side, used by the web app. Values come straight from the detector's
// records; the UI formats them but never recomputes dormancy.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToEvent(r: any): GhostEvent {
  return {
    id: r.id,
    txid: r.txid,
    blockHash: r.block_hash,
    blockHeight: r.block_height,
    blockTime: Number(r.block_time),
    dormantSats: Number(r.dormant_sats),
    dormantInputCount: r.dormant_input_count,
    totalInputCount: r.total_input_count,
    outputCount: r.output_count,
    oldestCreatedHeight: r.oldest_created_height,
    oldestCreatedTime: Number(r.oldest_created_time),
    maxAgeSeconds: Number(r.max_age_seconds),
    cohort: r.cohort as Cohort,
    origin: r.origin,
    status: r.status,
    detectedAt: new Date(r.detected_at).toISOString(),
  };
}

export interface FeedFilter {
  minCohort?: Cohort;
  minSats?: number;
  limit?: number;
  /** "recent" (default) or "largest". */
  order?: "recent" | "largest";
}

export async function listEvents(origin: "live" | "archive", f: FeedFilter = {}): Promise<GhostEvent[]> {
  const { rows } = await pool().query(
    `select * from ghost_events where origin = $1 and cohort >= $2 and dormant_sats >= $3
     order by ${f.order === "largest" ? "dormant_sats desc, block_height desc" : "block_height desc, dormant_sats desc"} limit $4`,
    [origin, f.minCohort ?? 5, f.minSats ?? 0, f.limit ?? 50],
  );
  return rows.map(rowToEvent);
}

export async function getEvent(id: string): Promise<GhostEventDetail | null> {
  if (!/^[0-9a-f]{16}$/.test(id)) return null;
  const { rows } = await pool().query("select * from ghost_events where id = $1", [id]);
  if (!rows[0]) return null;
  const [inputs, history] = await Promise.all([
    pool().query("select * from ghost_inputs where event_id = $1 order by input_index", [id]),
    pool().query("select * from event_history where event_id = $1 order by at, id", [id]),
  ]);
  return {
    ...rowToEvent(rows[0]),
    inputs: inputs.rows.map((r) => ({
      inputIndex: r.input_index,
      prevTxid: r.prev_txid,
      prevVout: r.prev_vout,
      createdHeight: r.created_height,
      createdTime: Number(r.created_time),
      valueSats: Number(r.value_sats),
      scriptType: r.script_type,
      qualifies: r.qualifies,
    })),
    history: history.rows.map((r) => ({
      fromStatus: r.from_status,
      toStatus: r.to_status,
      blockHash: r.block_hash,
      note: r.note,
      at: new Date(r.at).toISOString(),
    })),
  };
}

export async function getStatus(): Promise<FeedStatus> {
  const { rows } = await pool().query(
    `select c.*, extract(epoch from (now() - c.heartbeat_at))::float as hb_age, now() as server_time,
       (select max(block_height) from ghost_events where origin = 'live' and status = 'confirmed') as last_live_event_height
     from (select 1) one left join worker_checkpoints c on c.worker_name = $1`,
    [LIVE_WORKER],
  );
  const r = rows[0];
  const hbAge = r.hb_age == null ? null : Math.max(0, Math.round(r.hb_age));
  const lag = r.observed_tip != null && r.last_height != null ? r.observed_tip - r.last_height : null;
  return {
    // A worker that has checked in but not finished its first block isn't live yet.
    state: r.last_height == null ? "unknown" : classify(hbAge, lag),
    lastProcessedHeight: r.last_height ?? null,
    lastProcessedHash: r.last_hash ?? null,
    observedTip: r.observed_tip ?? null,
    heartbeatAt: r.heartbeat_at ? new Date(r.heartbeat_at).toISOString() : null,
    heartbeatAgeSeconds: hbAge,
    lastError: r.last_error ?? null,
    lastLiveEventHeight: r.last_live_event_height ?? null,
    serverTime: new Date(r.server_time).toISOString(),
  };
}

export async function getStats(): Promise<FeedStats> {
  const { rows } = await pool().query(
    `select count(*) filter (where origin = 'live')::int as live, count(*) filter (where origin = 'archive')::int as archive,
       max(dormant_sats) as largest, max(max_age_seconds) as longest
     from ghost_events where status = 'confirmed'`,
  );
  const r = rows[0];
  return {
    liveEvents: r.live,
    archiveEvents: r.archive,
    largestDormantSats: r.largest == null ? null : Number(r.largest),
    longestAgeSeconds: r.longest == null ? null : Number(r.longest),
  };
}

export async function getFeed(f: FeedFilter = {}): Promise<FeedPayload> {
  // Sequential on purpose: the local PGlite server multiplexes one connection.
  const status = await getStatus();
  const stats = await getStats();
  const events = await listEvents("live", f);
  // The archive is a showcase: the biggest 10+ year awakenings found by backfill.
  const archive = await listEvents("archive", { ...f, minCohort: Math.max(f.minCohort ?? 5, 10) as Cohort, limit: 8, order: "largest" });
  return { status, stats, events, archive };
}
