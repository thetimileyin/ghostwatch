import { connection } from "next/server";
import { getPriceHistory } from "@/lib/pulse/price-server";

// Bitcoin's daily closing price since July 2010, plus the all-time high and yearly summaries.
export async function GET() {
  await connection();
  const data = await getPriceHistory();
  if (!data) return Response.json({ error: "Price history unavailable" }, { status: 503 });
  return Response.json(data, { headers: { "cache-control": "public, max-age=1800" } });
}
