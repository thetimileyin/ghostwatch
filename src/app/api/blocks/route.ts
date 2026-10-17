import { connection } from "next/server";
import { getDayOfBlocks } from "@/lib/pulse/server";

// Roughly the last 24 hours of blocks.
export async function GET() {
  await connection();
  try {
    return Response.json(await getDayOfBlocks(), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("blocks history failed:", err);
    return Response.json([], { status: 503 });
  }
}
