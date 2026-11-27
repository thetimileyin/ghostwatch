// Prints ready-to-post drafts from GhostWatch's live data, for your own Nostr or X account.
// Usage: npm run posts   (reads https://bitcoinghostwatch.online, or SITE=http://localhost:3000)
import { btcShort, durationLong, heightLabel, monthYear } from "../src/lib/domain/format";
import type { Pulse } from "../src/lib/pulse/types";

const SITE = (process.env.SITE ?? "https://bitcoinghostwatch.online").replace(/\/$/, "");
const host = SITE.replace(/^https?:\/\//, "");
const n = (v: number) => Math.round(v).toLocaleString("en-US");

async function main() {
  const p = (await fetch(`${SITE}/api/pulse`, { signal: AbortSignal.timeout(30_000) }).then((r) => r.json())) as Pulse;
  const drafts: { title: string; text: string }[] = [];

  // The oldest notable awakening of the last 24 hours.
  const day = p.ghostDay;
  const top = day?.top?.[0];
  if (day && top) {
    drafts.push({
      title: "Awakening of the day",
      text: [
        `${btcShort(top.dormantSats)} just moved for the first time since ${monthYear(top.oldestCreatedTime)}.`,
        ``,
        `${durationLong(top.oldestCreatedTime, top.blockTime)} untouched. It moved in block ${heightLabel(top.blockHeight)}.`,
        ``,
        `In the last 24 hours, ${n(day.all)} old coins woke up. ${n(day.notable)} were notable: 10+ years asleep and 1 BTC or more.`,
        ``,
        `${SITE}/e/${top.id}`,
      ].join("\n"),
    });
  }

  // The biggest notable awakening, when it isn't the same one.
  const biggest = day?.top?.slice().sort((a, b) => b.dormantSats - a.dormantSats)[0];
  if (biggest && biggest.id !== top?.id) {
    drafts.push({
      title: "Biggest awakening today",
      text: [
        `${btcShort(biggest.dormantSats)} that last moved in ${monthYear(biggest.oldestCreatedTime)} just woke up, in block ${heightLabel(biggest.blockHeight)}.`,
        ``,
        `Not proof of a sale, a hack, or who owns it. The chain only shows that it moved.`,
        ``,
        `${SITE}/e/${biggest.id}`,
      ].join("\n"),
    });
  }

  // Fees and the queue.
  if (p.fees && p.mempool) {
    const cheap = p.fees.fastest <= 3;
    drafts.push({
      title: cheap ? "Cheap block space" : "Busy mempool",
      text: [
        `${n(p.mempool.count)} transactions are waiting right now, and getting into the next block costs ${p.fees.fastest} sat/vB.`,
        ``,
        cheap ? `If you've been waiting to consolidate UTXOs, this is the window.` : `If it can wait, ${p.fees.economy} sat/vB should still get there, just slower.`,
        ``,
        host,
      ].join("\n"),
    });
  }

  // Who's mining.
  const pools = p.network.pools24h;
  if (pools.length >= 3) {
    const blocks = pools.reduce((s, x) => s + x.blocks, 0);
    const top2 = pools.slice(0, 2);
    drafts.push({
      title: "Who's mining",
      text: [
        `Of the last ${blocks} blocks, ${top2.map((x) => `${x.name} found ${x.blocks}`).join(" and ")}.`,
        ``,
        `Together that's ${Math.round(top2.reduce((s, x) => s + x.share, 0) * 100)}% of blocks from two pools.`,
        ``,
        host,
      ].join("\n"),
    });
  }

  for (const d of drafts) console.log(`── ${d.title} ${"─".repeat(Math.max(0, 50 - d.title.length))}\n${d.text}\n`);
  if (!drafts.length) console.log("The live data didn't come back. Try again in a minute.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
