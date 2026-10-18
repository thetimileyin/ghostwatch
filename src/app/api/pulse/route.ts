import { connection } from "next/server";
import { touch, watching } from "@/lib/pulse/presence";
import { getPulse } from "@/lib/pulse/server";

// Live network snapshot. Cached server-side for a few seconds; never cached by the browser.
// The x-gw-tab header is a random per-tab code used only to count people watching now.
export async function GET(req: Request) {
  await connection();
  touch(req.headers.get("x-gw-tab"));
  try {
    const pulse = await getPulse();
    return Response.json({ ...pulse, watching: watching() }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
