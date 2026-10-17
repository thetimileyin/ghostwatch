import { connection } from "next/server";
import { getPulse } from "@/lib/pulse/server";

// Live network snapshot. Cached server-side for a few seconds; never cached by the browser.
export async function GET() {
  await connection();
  try {
    return Response.json(await getPulse(), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
