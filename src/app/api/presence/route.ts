import { connection } from "next/server";
import { leave } from "@/lib/pulse/presence";

// A closing tab sends its random code here (navigator.sendBeacon) so it stops being counted at once.
export async function POST(req: Request) {
  await connection();
  const code = (await req.text().catch(() => "")).trim();
  leave(code);
  return new Response(null, { status: 204 });
}
