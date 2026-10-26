import { connection } from "next/server";
import { listEvents } from "@/lib/db/read";
import { getPulse } from "@/lib/pulse/server";

// What the search box shows before anything is typed: the newest block and the latest
// coins that woke up. Public chain data only; nothing about the visitor.
export async function GET() {
  await connection();
  const [pulse, live] = await Promise.all([getPulse().catch(() => null), listEvents("live", { limit: 3 }).catch(() => [])]);
  const woke = live.length ? live : await listEvents("archive", { limit: 3 }).catch(() => []);
  const tip = pulse?.blocks?.[0];
  return Response.json(
    {
      block: tip ? { height: tip.height, time: tip.time, txCount: tip.txCount } : null,
      woke: woke.map((e) => ({ txid: e.txid, dormantSats: e.dormantSats, maxAgeSeconds: e.maxAgeSeconds, blockTime: e.blockTime })),
    },
    { headers: { "cache-control": "public, max-age=30" } },
  );
}
