import { SimplePool, finalizeEvent, getPublicKey, nip19 } from "nostr-tools";
import { dateShort, heightLabel, monthYear } from "@/lib/domain/format";
import { headline } from "@/lib/domain/signal";
import type { GhostEvent } from "@/lib/domain/types";
import { deliverPending } from "./queue";
import { eventUrl } from "./telegram";

/**
 * GhostWatch's own Nostr account: posts notable awakenings as they're found. Off unless
 * NOSTR_SECRET_KEY is set on the server (create it with `npm run nostr:key`).
 */

export const NOSTR = "nostr";

// A note counts as sent when any one accepts it. (damus refuses some datacenter addresses.)
const DEFAULT_RELAYS = ["wss://nos.lol", "wss://relay.primal.net", "wss://offchain.pub", "wss://relay.snort.social", "wss://relay.damus.io"];
const SEND_TIMEOUT_MS = 15_000;

export function nostrRelays(): string[] {
  const list = (process.env.NOSTR_RELAYS ?? "").split(",").map((r) => r.trim()).filter((r) => r.startsWith("wss://"));
  return list.length ? list : DEFAULT_RELAYS;
}

/** The secret key from an nsec or 64 hex characters; null when unset or malformed. */
export function parseSecret(value: string | undefined): Uint8Array | null {
  const v = value?.trim();
  if (!v) return null;
  try {
    if (v.startsWith("nsec1")) {
      const d = nip19.decode(v);
      return d.type === "nsec" ? d.data : null;
    }
    if (/^[0-9a-f]{64}$/i.test(v)) return Uint8Array.from(v.match(/../g)!.map((b) => parseInt(b, 16)));
  } catch {
    /* malformed */
  }
  return null;
}

export const nostrSecret = () => parseSecret(process.env.NOSTR_SECRET_KEY);

export function newEventNote(e: GhostEvent): string {
  return [
    `${headline(e)}.`,
    `Created ${monthYear(e.oldestCreatedTime)} · spent in block ${heightLabel(e.blockHeight)} (${dateShort(e.blockTime)}).`,
    `Not proof of a sale, a hack, or who owns it.`,
    eventUrl(e),
    `#bitcoin`,
  ].join("\n");
}

export function correctionNote(e: GhostEvent): string {
  return [`Correction: the block with this event was replaced by a chain reorganization. It is no longer confirmed.`, eventUrl(e)].join("\n");
}

/** Signs and sends one event; succeeds when at least one relay accepts it. Returns its id. */
async function publish(sk: Uint8Array, kind: number, content: string, tags: string[][]): Promise<string> {
  const event = finalizeEvent({ kind, created_at: Math.floor(Date.now() / 1000), tags, content }, sk);
  const relays = nostrRelays();
  const pool = new SimplePool();
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no relay answered in time")), SEND_TIMEOUT_MS));
    await Promise.race([Promise.any(pool.publish(relays, event)), timeout]).catch((err) => {
      throw new Error(err instanceof AggregateError ? `every relay refused: ${err.errors.map(String).join("; ").slice(0, 200)}` : String(err?.message ?? err));
    });
    return event.id;
  } finally {
    pool.close(relays);
  }
}

/** Deliver pending Nostr notes: at most NOSTR_MAX_PER_DAY a day, nothing older than 6 hours. */
export async function publishPendingNostr(log: (m: string) => void = () => {}): Promise<number> {
  const sk = nostrSecret();
  if (!sk) return 0;
  const maxPerDay = Number(process.env.NOSTR_MAX_PER_DAY || 6);
  return deliverPending(NOSTR, {
    log,
    maxPerDay,
    maxAgeMs: 6 * 3600_000,
    send: (d) =>
      d.kind === "new"
        ? publish(sk, 1, newEventNote(d.event), [["t", "bitcoin"], ["r", eventUrl(d.event)]])
        : publish(sk, 1, correctionNote(d.event), d.originalId ? [["e", d.originalId, "", "root"]] : []),
  });
}

/** Sets the account's name, description and links (replaces the previous profile). */
export async function publishNostrProfile(log: (m: string) => void = () => {}): Promise<void> {
  const sk = nostrSecret();
  if (!sk) return;
  const base = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const profile = {
    name: "GhostWatch",
    display_name: "GhostWatch",
    about:
      "Old bitcoin waking up. Coins unspent for 10+ years, 1 BTC or more, posted as each new block confirms them. Not proof of a sale, a hack, or who owns them. Live terminal: " +
      base,
    website: base,
    picture: `${base}/apple-icon`,
  };
  try {
    await publish(sk, 0, JSON.stringify(profile), []);
    log(`nostr: profile set for ${nip19.npubEncode(getPublicKey(sk))}`);
  } catch (err) {
    log(`nostr: profile not set: ${err instanceof Error ? err.message : String(err)}`);
  }
}
