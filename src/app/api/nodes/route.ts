import { connection } from "next/server";
import { getNodes } from "@/lib/pulse/server";

// Locations of reachable Bitcoin nodes (public snapshot, refreshed hourly).
export async function GET() {
  await connection();
  const data = await getNodes();
  if (!data) return Response.json({ error: "Node snapshot unavailable" }, { status: 503 });
  return Response.json(data, { headers: { "cache-control": "public, max-age=600" } });
}
