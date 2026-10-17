import { connection, type NextRequest } from "next/server";
import { getStats, listEvents } from "@/lib/db/read";
import { parseFeedQuery, toFilter } from "@/lib/domain/filters";

// Archive events (found by backfilling past blocks), largest first.
export async function GET(req: NextRequest) {
  await connection();
  try {
    const q = parseFeedQuery(req.nextUrl.searchParams);
    const stats = await getStats();
    const events = await listEvents("archive", { ...toFilter(q), order: "largest", limit: 120 });
    return Response.json({ stats, events }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Archive temporarily unavailable" }, { status: 503 });
  }
}
