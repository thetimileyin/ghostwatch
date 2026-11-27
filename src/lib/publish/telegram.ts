import { dateShort, heightLabel, monthYear } from "@/lib/domain/format";
import { headline } from "@/lib/domain/signal";
import type { GhostEvent } from "@/lib/domain/types";
import { deliverPending } from "./queue";

export const TELEGRAM = "telegram";

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

/** Deliver pending Telegram notifications (corrections reply to the original message). */
export async function publishPending(log: (m: string) => void = () => {}): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) return 0;
  return deliverPending(TELEGRAM, {
    log,
    send: (d) => send(token, chatId, d.kind === "new" ? newEventMessage(d.event) : correctionMessage(d.event), d.kind === "correction" ? d.originalId ?? undefined : undefined),
  });
}
