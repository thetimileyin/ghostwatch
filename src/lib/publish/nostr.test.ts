import { describe, expect, it } from "vitest";
import { finalizeEvent, generateSecretKey, nip19, verifyEvent } from "nostr-tools";
import type { GhostEvent } from "@/lib/domain/types";
import { newEventNote, nostrRelays, parseSecret } from "./nostr";

const event = {
  id: "abc123", txid: "t", blockHash: "h", blockHeight: 977790, blockTime: 1795770000, dormantSats: 12_314_020_000,
  dormantInputCount: 1, totalInputCount: 1, outputCount: 1, oldestCreatedHeight: 240000, oldestCreatedTime: 1372300000,
  maxAgeSeconds: 13 * 365 * 86400, cohort: 10, status: "confirmed",
} as unknown as GhostEvent;

describe("nostr", () => {
  it("reads a secret key as nsec or hex, and rejects anything else", () => {
    const sk = generateSecretKey();
    expect(parseSecret(nip19.nsecEncode(sk))).toEqual(sk);
    expect(parseSecret(Buffer.from(sk).toString("hex"))).toEqual(sk);
    expect(parseSecret("")).toBeNull();
    expect(parseSecret("nsec1notakey")).toBeNull();
    expect(parseSecret(undefined)).toBeNull();
  });

  it("writes a plain-words note with the caveat, the link and a tag", () => {
    const text = newEventNote(event);
    expect(text).toContain("123.14 BTC");
    expect(text).toContain("June 2013");
    expect(text).toContain("Not proof of a sale, a hack, or who owns it.");
    expect(text).toMatch(/\/e\/abc123$/m);
    const signed = finalizeEvent({ kind: 1, created_at: 1, tags: [["t", "bitcoin"]], content: text }, generateSecretKey());
    expect(verifyEvent(signed)).toBe(true);
  });

  it("uses default relays unless valid ones are configured", () => {
    expect(nostrRelays().length).toBeGreaterThan(0);
    process.env.NOSTR_RELAYS = "wss://a.example, http://nope";
    expect(nostrRelays()).toEqual(["wss://a.example"]);
    delete process.env.NOSTR_RELAYS;
  });
});
