import type { PoolClient } from "pg";
import type { DetectedEvent } from "@/lib/detector/detect";
import type { EventOrigin } from "@/lib/domain/types";
import { pool, withTx } from "./pool";

// Write side, used by the worker. Every write that belongs to one block happens
// in one transaction, so a crash never leaves a half-processed block.

export interface StoredBlock {
  hash: string;
  height: number;
  parentHash: string;
  time: number;
}

export async function mainBlockAt(height: number): Promise<StoredBlock | null> {
  const { rows } = await pool().query(
    "select hash, height, parent_hash, time from blocks where height = $1 and status = 'main'",
    [height],
  );
  const r = rows[0];
  return r ? { hash: r.hash, height: r.height, parentHash: r.parent_hash, time: Number(r.time) } : null;
}

export async function cachedBlockTime(height: number): Promise<number | null> {
  const { rows } = await pool().query("select time from block_times where height = $1", [height]);
  return rows[0] ? Number(rows[0].time) : null;
}

export async function cacheBlockTime(height: number, hash: string, time: number): Promise<void> {
  await pool().query("insert into block_times (height, hash, time) values ($1, $2, $3) on conflict (height) do nothing", [height, hash, time]);
}

export async function getCheckpoint(worker: string) {
  const { rows } = await pool().query("select last_height, last_hash from worker_checkpoints where worker_name = $1", [worker]);
  return rows[0] ? { lastHeight: rows[0].last_height as number | null, lastHash: rows[0].last_hash as string | null } : null;
}

export async function heartbeat(worker: string, observedTip: number): Promise<void> {
  await pool().query(
    `insert into worker_checkpoints (worker_name, observed_tip, heartbeat_at, updated_at) values ($1, $2, now(), now())
     on conflict (worker_name) do update set observed_tip = $2, heartbeat_at = now(), updated_at = now()`,
    [worker, observedTip],
  );
}

export async function recordError(worker: string, message: string): Promise<void> {
  await pool().query(
    `insert into worker_checkpoints (worker_name, last_error, last_error_at, updated_at) values ($1, $2, now(), now())
     on conflict (worker_name) do update set last_error = $2, last_error_at = now(), updated_at = now()`,
    [worker, message.slice(0, 500)],
  );
}

async function insertEvent(c: PoolClient, e: DetectedEvent, origin: EventOrigin, publishTo: string[]) {
  // A reorg can re-mine the same tx in a different block: keep the permalink, update the block.
  const existing = await c.query("select status, block_hash from ghost_events where id = $1", [e.id]);
  if (existing.rows[0]) {
    const prev = existing.rows[0];
    if (prev.status === "confirmed" && prev.block_hash === e.blockHash) return; // replay of the same block
    await c.query(
      `update ghost_events set block_hash = $2, block_height = $3, block_time = $4, max_age_seconds = $5, cohort = $6,
         oldest_created_time = $7, status = 'confirmed', updated_at = now() where id = $1`,
      [e.id, e.blockHash, e.blockHeight, e.blockTime, e.maxAgeSeconds, e.cohort, e.oldestCreatedTime],
    );
    await c.query("insert into event_history (event_id, from_status, to_status, block_hash, note) values ($1, $2, 'confirmed', $3, $4)", [
      e.id,
      prev.status,
      e.blockHash,
      prev.status === "reversed"
        ? prev.block_hash === e.blockHash ? "Re-confirmed after the reorganization resolved" : "Re-confirmed in a different block after a reorganization"
        : "Moved to a different block",
    ]);
    return;
  }
  await c.query(
    `insert into ghost_events (id, txid, block_hash, block_height, block_time, dormant_sats, dormant_input_count, total_input_count,
       output_count, oldest_created_height, oldest_created_time, max_age_seconds, cohort, origin)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [e.id, e.txid, e.blockHash, e.blockHeight, e.blockTime, e.dormantSats, e.dormantInputCount, e.totalInputCount, e.outputCount,
      e.oldestCreatedHeight, e.oldestCreatedTime, e.maxAgeSeconds, e.cohort, origin],
  );
  for (const i of e.inputs) {
    await c.query(
      `insert into ghost_inputs (event_id, input_index, prev_txid, prev_vout, created_height, created_time, value_sats, script_type, qualifies)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [e.id, i.inputIndex, i.prevTxid, i.prevVout, i.createdHeight, i.createdTime, i.valueSats, i.scriptType, i.qualifies],
    );
  }
  await c.query("insert into event_history (event_id, from_status, to_status, block_hash) values ($1, null, 'confirmed', $2)", [e.id, e.blockHash]);
  for (const channel of publishTo) {
    await c.query("insert into notifications (event_id, channel, kind) values ($1, $2, 'new') on conflict do nothing", [e.id, channel]);
  }
}

/** Persist a processed block, its events and the checkpoint atomically. */
export async function commitBlock(
  worker: string,
  block: StoredBlock,
  events: DetectedEvent[],
  origin: EventOrigin,
  publishTo: (e: DetectedEvent) => string[],
): Promise<void> {
  await withTx(async (c) => {
    await c.query(
      `insert into blocks (hash, height, parent_hash, time) values ($1, $2, $3, $4)
       on conflict (hash) do update set status = 'main', processed_at = now()`,
      [block.hash, block.height, block.parentHash, block.time],
    );
    for (const e of events) await insertEvent(c, e, origin, publishTo(e));
    if (origin === "live") {
      await c.query(
        `insert into worker_checkpoints (worker_name, last_height, last_hash, heartbeat_at, updated_at) values ($1, $2, $3, now(), now())
         on conflict (worker_name) do update set last_height = $2, last_hash = $3, heartbeat_at = now(), last_error = null, updated_at = now()`,
        [worker, block.height, block.hash],
      );
    }
  });
}

/**
 * Undo blocks above `forkHeight` after a reorganization: mark them orphaned,
 * reverse their events (keeping the pages), and queue corrections for any
 * event that was already published.
 */
export async function rollbackTo(worker: string, forkHeight: number, forkHash: string): Promise<string[]> {
  return withTx(async (c) => {
    const orphaned = await c.query("update blocks set status = 'orphaned' where status = 'main' and height > $1 returning hash", [forkHeight]);
    const hashes = orphaned.rows.map((r) => r.hash as string);
    if (hashes.length === 0) return [];
    const reversed = await c.query(
      "update ghost_events set status = 'reversed', updated_at = now() where block_hash = any($1) and status = 'confirmed' returning id, block_hash",
      [hashes],
    );
    for (const r of reversed.rows) {
      await c.query(
        "insert into event_history (event_id, from_status, to_status, block_hash, note) values ($1, 'confirmed', 'reversed', $2, 'Block replaced by a chain reorganization')",
        [r.id, r.block_hash],
      );
      // Unsent announcements are cancelled; sent ones get a correction.
      await c.query("update notifications set status = 'cancelled', updated_at = now() where event_id = $1 and kind = 'new' and status in ('pending', 'failed')", [r.id]);
      await c.query(
        `insert into notifications (event_id, channel, kind)
         select event_id, channel, 'correction' from notifications where event_id = $1 and kind = 'new' and status = 'sent'
         on conflict do nothing`,
        [r.id],
      );
    }
    await c.query(
      "update worker_checkpoints set last_height = $2, last_hash = $3, updated_at = now() where worker_name = $1",
      [worker, forkHeight, forkHash],
    );
    return reversed.rows.map((r) => r.id as string);
  });
}
