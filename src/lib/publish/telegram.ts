import { pool } from "@/lib/db/pool";
import { dateShort, heightLabel, monthYear } from "@/lib/domain/format";
import { headline } from "@/lib/domain/signal";
import type { GhostEvent } from "@/lib/domain/types";
import { rowToEvent } from "@/lib/db/read";

export const TELEGRAM = "telegram";
const MAX_ATTEMPTS = 5;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function eventUrl(e: Pick<GhostEvent, "id">): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/e/${e.id}`;
}

export function newEventMessage(e: GhostEvent): string {
  return [
    `<b>${esc(headline(e))}.</b>`,
    `Created ${monthYear(e.oldestCreatedTime)} · spent in block ${heightLabel(e.blockHeight)} (${dateShort(e.blockTime)}).`,
    `Not proof of a sale, a hack, or who owns it.`,
    eventUrl(e),
  ].join("\n");
}

export function correctionMessage(e: GhostEvent): string {
  return [
    `<b>Correction:</b> the block containing this event was replaced by a chain reorganization. It is no longer confirmed.`,
    eventUrl(e),
  ].join("\n");
}

async function send(token: string, chatId: string, text: string, replyTo?: string): Promise<string> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: false },
      ...(replyTo ? { reply_parameters: { message_id: Number(replyTo), allow_sending_without_reply: true } } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json()) as { ok: boolean; description?: string; result?: { message_id: number } };
  if (!body.ok) throw new Error(body.description ?? `HTTP ${res.status}`);
  return String(body.result!.message_id);
}

/**
 * Deliver pending Telegram notifications. Each row is marked 'sending' before
 * the API call, so a restart never re-posts something that may have gone out;
 * explicit API failures stay retryable until MAX_ATTEMPTS.
 */
export async function publishPending(log: (m: string) => void = () => {}): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) return 0;

  const { rows } = await pool().query(
    `select n.kind, n.attempts, e.*,
       (select external_message_id from notifications s where s.event_id = e.id and s.channel = n.channel and s.kind = 'new') as original_message_id
     from notifications n join ghost_events e on e.id = n.event_id
     where n.channel = $1 and n.status in ('pending', 'failed') and n.attempts < $2
     order by e.block_height, e.id limit 20`,
    [TELEGRAM, MAX_ATTEMPTS],
  );
  let sent = 0;
  for (const r of rows) {
    const e = rowToEvent(r);
    // Don't announce something that was reversed before we got to it.
    if (r.kind === "new" && e.status !== "confirmed") {
      await pool().query("update notifications set status = 'cancelled', updated_at = now() where event_id = $1 and channel = $2 and kind = 'new'", [e.id, TELEGRAM]);
      continue;
    }
    await pool().query("update notifications set status = 'sending', attempts = attempts + 1, updated_at = now() where event_id = $1 and channel = $2 and kind = $3", [e.id, TELEGRAM, r.kind]);
    try {
      const text = r.kind === "new" ? newEventMessage(e) : correctionMessage(e);
      const id = await send(token, chatId, text, r.kind === "correction" ? r.original_message_id ?? undefined : undefined);
      await pool().query(
        "update notifications set status = 'sent', external_message_id = $4, last_error = null, updated_at = now() where event_id = $1 and channel = $2 and kind = $3",
        [e.id, TELEGRAM, r.kind, id],
      );
      sent += 1;
      log(`telegram: sent ${r.kind} for ${e.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await pool().query("update notifications set status = 'failed', last_error = $4, updated_at = now() where event_id = $1 and channel = $2 and kind = $3", [e.id, TELEGRAM, r.kind, msg.slice(0, 300)]);
      log(`telegram: failed ${r.kind} for ${e.id}: ${msg}`);
    }
  }
  return sent;
}
