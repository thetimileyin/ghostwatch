import { pool } from "@/lib/db/pool";
import { getStatus } from "@/lib/db/read";

// Operator health: detector progress, last error and notification backlog.
// 200 when live, 503 otherwise, so an uptime monitor can alert on it.
export async function GET() {
  try {
    const status = await getStatus();
    const { rows } = await pool().query(
      "select channel, status, count(*)::int as n from notifications group by channel, status order by channel, status",
    );
    const body = { ...status, notifications: rows };
    return Response.json(body, { status: status.state === "live" ? 200 : 503, headers: { "cache-control": "no-store" } });
  } catch (err) {
    return Response.json(
      { state: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
