import { connection } from "next/server";
import { listEvents } from "@/lib/db/read";
import { headline, summary } from "@/lib/domain/signal";

const BASE = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * RSS feed of coins that woke up while GhostWatch was watching (live events only; the
 * archive was never alerted). Follow it in any feed reader: no account, nothing tracked.
 */
export async function GET() {
  await connection();
  const events = await listEvents("live", { limit: 50 }).catch(() => []);
  const items = events
    .map((e) => {
      const url = `${BASE}/e/${e.id}`;
      return `    <item>
      <title>${esc(headline(e))}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(e.blockTime * 1000).toUTCString()}</pubDate>
      <description>${esc(`${summary(e)} Not proof of a sale, a hack, or who owns it.`)}</description>
    </item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GhostWatch: old bitcoin waking up</title>
    <link>${BASE}/feed</link>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Coins unspent for five years or more that just moved, read from every new Bitcoin block.</description>
    <language>en</language>
    <ttl>10</ttl>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
