"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { monthYear } from "@/lib/domain/format";
import { btc, compact, sinceShort, usd } from "@/lib/pulse/format";
import type { NodesSnapshot, Pulse } from "@/lib/pulse/types";
import { usePulse, useNow } from "@/lib/pulse/use-pulse";
import { Globe } from "./globe";

/**
 * The live layer of the landing page, drawn like a technical sheet: the globe sits
 * out of focus behind the headline, [0x] indices point at real readings, a seal counts toward the next block, and the last blocks run along
 * the bottom. One poller feeds all of it.
 */
export function LandingLive() {
  const live = usePulse();
  const now = useNow();
  const [nodes, setNodes] = useState<NodesSnapshot | null>(null);
  useEffect(() => {
    fetch("/api/nodes")
      .then((r) => (r.ok ? r.json() : null))
      .then(setNodes)
      .catch(() => {});
  }, []);
  const p = live.pulse;
  const ghost = p?.ghosts[0];
  const tip = p?.blocks[0];
  const since = tip ? Math.max(0, now / 1000 - tip.time) : 0;

  return (
    <div className="lx-scene" aria-label="Bitcoin's network, live">
      <div className="lx-globe" aria-hidden="true">
        <Globe nodes={nodes} newTxs={live.newTxs} newBlock={live.newBlock} fastestFee={p?.fees?.fastest ?? null} labels={false} />
      </div>

      <span className="lx-tag" style={{ left: "47%", top: "16%" }} aria-hidden="true">[01]</span>
      <span className="lx-tag" style={{ left: "52%", top: "57%" }} aria-hidden="true">[02]</span>
      <span className="lx-tag" style={{ left: "77%", top: "56%" }} aria-hidden="true">[03]</span>

      <div className="lx-cap lx-cap--nodes">
        <span className="lx-cap-k">[01] Reachable nodes</span>
        <b className="num">{nodes ? compact(nodes.totalNodes) : "—"}</b>
      </div>

      {ghost && (
        <Link href={`/e/${ghost.id}`} className="lx-cap lx-cap--ghost">
          <span className="lx-cap-k">[02] Woke up {sinceShort(ghost.blockTime, now)}</span>
          <b className="num">{btc(ghost.dormantSats)}</b>
          <span>unspent since {monthYear(ghost.oldestCreatedTime)}</span>
        </Link>
      )}

      <Seal height={tip?.height ?? null} since={since} pool={tip?.pool ?? null} />

      <p className="lx-margin" aria-hidden="true">
        {tip ? `Block ${tip.height.toLocaleString("en-US")}` : "Connecting"} · No accounts · Public data only · Verify on mempool.space
      </p>

      <ChainRibbon pulse={p} now={now} />
    </div>
  );
}

/**
 * Block seal: ten ring segments for the ten-minute average block interval, lit as
 * time passes since the last block. Text on the ring is what GhostWatch stands on.
 */
function Seal({ height, since, pool }: { height: number | null; since: number; pool: string | null }) {
  const lit = Math.min(10, Math.floor(since / 60));
  const R = 78;
  const seg = (i: number) => {
    const a0 = ((i * 36 + 3 - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * 36 - 3 - 90) * Math.PI) / 180;
    // Rounded so server and browser produce identical markup (float maths can differ in the last digit).
    const f = (n: number) => n.toFixed(2);
    return `M ${f(100 + R * Math.cos(a0))} ${f(100 + R * Math.sin(a0))} A ${R} ${R} 0 0 1 ${f(100 + R * Math.cos(a1))} ${f(100 + R * Math.sin(a1))}`;
  };
  return (
    <div className="lx-seal" role="img" aria-label={height ? `Block ${height}, found ${Math.floor(since / 60)} minutes ago` : "Waiting for the latest block"}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <path id="seal-ring" d="M 100 100 m -94 0 a 94 94 0 1 1 188 0 a 94 94 0 1 1 -188 0" />
        </defs>
        <text className="lx-seal-text">
          <textPath href="#seal-ring" textLength="580">
            DON&apos;T TRUST · VERIFY · PUBLIC DATA · NO ACCOUNTS · ONE BLOCK EVERY ~10 MIN ·
          </textPath>
        </text>
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={seg(i)} className={i < lit ? "lx-seg on" : "lx-seg"} />
        ))}
      </svg>
      <div className="lx-seal-in">
        <span className="lx-cap-k">[03] Next block</span>
        <b className="num">+{Math.floor(since / 60)}:{String(Math.floor(since % 60)).padStart(2, "0")}</b>
        <span className="lx-seal-sub">{height ? `after ${height.toLocaleString("en-US")}` : "…"}{pool ? ` · ${pool}` : ""}</span>
      </div>
    </div>
  );
}

function tone(median: number) {
  if (median >= 20) return "hot";
  if (median >= 5) return "busy";
  if (median >= 2) return "warm";
  return "calm";
}

/** The last few blocks, bracketed like a specimen, ending in the next one filling with time. */
function ChainRibbon({ pulse, now }: { pulse: Pulse | null; now: number }) {
  const blocks = (pulse?.blocks ?? []).slice(0, 6).reverse();
  const tip = pulse?.blocks[0];
  const since = tip ? Math.max(0, now / 1000 - tip.time) : 0;
  return (
    <div className="lx-chain" aria-label="Latest blocks">
      <span className="lx-chain-k">Latest blocks · fill = how full · orange = fee spike</span>
      <ol>
        {blocks.map((b) => (
          <li key={b.height} className={`lx-blk lx-blk--${tone(b.medianFee)}`} style={{ ["--f" as string]: Math.min(1, b.weight / 4_000_000) }}>
            <span className="lx-blk-box" aria-hidden="true"><i /></span>
            <span className="lx-blk-h num">{b.height.toLocaleString("en-US")}</span>
            <span className="lx-blk-s">{b.pool ?? "Unknown"} · {sinceShort(b.time, now)}</span>
          </li>
        ))}
        <li className="lx-blk lx-blk--next" style={{ ["--f" as string]: Math.min(1, since / 600) }}>
          <span className="lx-blk-box" aria-hidden="true"><i /></span>
          <span className="lx-blk-h num">{tip ? (tip.height + 1).toLocaleString("en-US") : "—"}</span>
          <span className="lx-blk-s">next</span>
        </li>
      </ol>
      <div className="lx-chain-meta">
        <span className="lx-stat"><b className="num">{pulse?.mempool ? pulse.mempool.count.toLocaleString("en-US") : "—"}</b><em>waiting</em></span>
        <span className="lx-stat"><b className="num">{usd(pulse?.priceUsd ?? null)}</b><em>per bitcoin</em></span>
        <span className="lx-stat lx-watch" title="Tabs open on GhostWatch right now. Counted anonymously: no cookies, no IP addresses.">
          <b className="num"><i aria-hidden="true" />{pulse?.watching != null ? pulse.watching.toLocaleString("en-US") : "—"}</b><em>watching now</em>
        </span>
      </div>
    </div>
  );
}
