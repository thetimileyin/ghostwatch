import type { NextRequest } from "next/server";
import { getFeed } from "@/lib/db/read";
import { parseFeedQuery, toFilter } from "@/lib/domain/filters";

// Public, read-only. Always fresh: the client uses it to poll the terminal.
export async function GET(req: NextRequest) {
  try {
    const feed = await getFeed(toFilter(parseFeedQuery(req.nextUrl.searchParams)));
    return Response.json(feed, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Feed temporarily unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
