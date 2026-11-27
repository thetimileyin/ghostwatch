import { pool } from "@/lib/db/pool";
import { rowToEvent } from "@/lib/db/read";
import type { GhostEvent } from "@/lib/domain/types";

const MAX_ATTEMPTS = 5;

export interface Delivery {
  kind: "new" | "correction";
  event: GhostEvent;
  /** For a correction: the id of the announcement it corrects, on this channel. */
  originalId: string | null;
}

export interface DeliverOptions {
  /** Sends one message and returns the channel's id for it. Throws on failure. */
  send: (d: Delivery) => Promise<string>;
  /** Announcements already sent in the last 24 hours at which further ones are dropped. */
  maxPerDay?: number;
  /** Announcements for blocks older than this are dropped (e.g. after a long catch-up). */
  maxAgeMs?: number;
  log?: (m: string) => void;
}

/**
 * Deliver pending notifications for one channel. Each row is marked 'sending' before the
 * send, so a restart never re-posts something that may have gone out; explicit failures
 * stay retryable until MAX_ATTEMPTS. Corrections are always delivered.
 */
export async function deliverPending(channel: string, opts: DeliverOptions): Promise<number> {
  const log = opts.log ?? (() => {});
  const { rows } = await pool().query(
    `select n.kind, n.attempts, e.*,
       (select external_message_id from notifications s where s.event_id = e.id and s.channel = n.channel and s.kind = 'new') as original_message_id
     from notifications n join ghost_events e on e.id = n.event_id
     where n.channel = $1 and n.status in ('pending', 'failed') and n.attempts < $2
     order by e.block_height, e.id limit 20`,
    [channel, MAX_ATTEMPTS],
  );
  const setStatus = (id: string, kind: string, sql: string, extra: unknown[] = []) =>
    pool().query(`update notifications set ${sql}, updated_at = now() where event_id = $1 and channel = $2 and kind = $3`, [id, channel, kind, ...extra]);

  let sentToday: number | null = null;
  let sent = 0;
  for (const r of rows) {
    const e = rowToEvent(r);
    if (r.kind === "new") {
      // Don't announce something that was reversed before we got to it, or that's old news.
      const stale = opts.maxAgeMs != null && Date.now() - e.blockTime * 1000 > opts.maxAgeMs;
      if (e.status !== "confirmed" || stale) {
        await setStatus(e.id, "new", "status = 'cancelled', last_error = $4", [stale ? "too old to announce" : "reversed before sending"]);
        continue;
      }
      if (opts.maxPerDay != null) {
        sentToday ??= Number(
          (await pool().query("select count(*) from notifications where channel = $1 and kind = 'new' and status = 'sent' and updated_at > now() - interval '24 hours'", [channel])).rows[0].count,
        );
        if (sentToday >= opts.maxPerDay) {
          await setStatus(e.id, "new", "status = 'cancelled', last_error = $4", ["daily limit reached"]);
          continue;
        }
      }
    }
    await setStatus(e.id, r.kind, "status = 'sending', attempts = attempts + 1");
    try {
      const id = await opts.send({ kind: r.kind, event: e, originalId: r.original_message_id ?? null });
      await setStatus(e.id, r.kind, "status = 'sent', external_message_id = $4, last_error = null", [id]);
      sent += 1;
      if (r.kind === "new" && sentToday != null) sentToday += 1;
      log(`${channel}: sent ${r.kind} for ${e.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await setStatus(e.id, r.kind, "status = 'failed', last_error = $4", [msg.slice(0, 300)]);
      log(`${channel}: failed ${r.kind} for ${e.id}: ${msg}`);
    }
  }
  return sent;
}
