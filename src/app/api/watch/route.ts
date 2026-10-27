import { connection } from "next/server";
import { addressType, normalizeAddress } from "@/lib/journey/address";
import { getAddressStory } from "@/lib/journey/address-server";
import { isTxid } from "@/lib/journey/journey";
import { getJourney } from "@/lib/journey/server";
import type { WatchState } from "@/lib/watch-change";

const MAX = 20;

/**
 * Current state of the coins a browser is watching. The list lives only in that browser;
 * it is sent here to check, answered from our short cache, and never stored or logged.
 * ?items=tx:<txid>,address:<addr>
 */
export async function GET(req: Request) {
  await connection();
  const items = (new URL(req.url).searchParams.get("items") ?? "").split(",").filter(Boolean).slice(0, MAX);
  const out: Record<string, WatchState | null> = {};
  await Promise.all(
    items.map(async (key) => {
      const [kind, ...rest] = key.split(":");
      const id = rest.join(":");
      if (kind === "tx" && isTxid(id)) {
        const r = await getJourney(id);
        out[key] = r.kind === "ok" ? { kind: "tx", confirmed: r.journey.confirmed, outputs: r.journey.outputs.length, spent: r.journey.outputs.filter((o) => o.next?.spent).length } : null;
      } else if (kind === "address" && addressType(id)) {
        const r = await getAddressStory(normalizeAddress(id));
        out[key] = r.kind === "ok" ? { kind: "address", txCount: r.story.txCount, balanceSats: r.story.balanceSats } : null;
      }
    }),
  );
  return Response.json(out, { headers: { "cache-control": "no-store" } });
}
