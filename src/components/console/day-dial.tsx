"use client";

import { btc, satvb, sinceShort } from "@/lib/pulse/format";
import type { PulseBlock } from "@/lib/pulse/types";
import type { usePulse } from "@/lib/pulse/use-pulse";
import { useView } from "./view";

// Terminal "Last 24 hours" view: every block of the past day around a clock face.
const DAY = 86400;

function feeColor(median: number): string {
  // dim ice for cheap blocks, signal cyan in the middle, amber when fees spike
  if (median >= 20) return "var(--accent)";
  if (median >= 5) return "var(--fg)";
  if (median >= 2) return "var(--fg-3)";
  return "var(--fg-4)";
}

/** The 24-hour block dial: reused by the terminal's Dial tab. */
export function Dial({ pulse, day, now }: { pulse: ReturnType<typeof usePulse>["pulse"]; day: PulseBlock[]; now: number }) {
  const view = useView();
  const nowS = now / 1000;
  const tip = day[0] ?? pulse?.blocks[0];
  const inDay = day.filter((b) => nowS - b.time <= DAY);
  const maxTx = Math.max(1, ...inDay.map((b) => b.txCount));
  const sinceLast = tip ? nowS - tip.time : 0;
  const progress = Math.min(1, sinceLast / 600);
  const ghosts = (pulse?.ghosts ?? []).filter((g) => nowS - g.blockTime <= DAY);

  // Geometry
  const S = 640, c = S / 2, rIn = 196, rMax = 292;
  const pos = (t: number, r: number) => {
    const a = (-((nowS - t) / DAY) * 360 - 90) * (Math.PI / 180);
    return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const;
  };
  const arcR = 150;
  const arcEnd = (() => {
    const a = (progress * 360 - 90) * (Math.PI / 180);
    return [c + Math.cos(a) * arcR, c + Math.sin(a) * arcR];
  })();

  return (
    <section className="obs-dial" aria-label="The last 24 hours of blocks">
        <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`${inDay.length} blocks in the last 24 hours. Last block ${tip ? sinceShort(tip.time, now) : ""}.`}>
          <defs>
            <radialGradient id="obs-glow">
              <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.08 }} />
              <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
            </radialGradient>
          </defs>
          <circle cx={c} cy={c} r={rMax + 20} fill="url(#obs-glow)" />
          <circle cx={c} cy={c} r={rIn} fill="none" style={{ stroke: "var(--line-2)" }} />
          <circle cx={c} cy={c} r={rMax + 8} fill="none" style={{ stroke: "var(--line-2)" }} strokeDasharray="2 6" />
          {[0, 6, 12, 18].map((hAgo) => {
            const [x, y] = pos(nowS - hAgo * 3600, rMax + 26);
            return (
              <text key={hAgo} x={x} y={y} className="obs-hour" textAnchor="middle" dominantBaseline="middle">
                {hAgo === 0 ? "now" : `−${hAgo}h`}
              </text>
            );
          })}
          {inDay.map((b) => {
            const len = 14 + (b.txCount / maxTx) * (rMax - rIn - 14);
            const [x1, y1] = pos(b.time, rIn + 4);
            const [x2, y2] = pos(b.time, rIn + 4 + len);
            return (
              <line key={b.height} x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: feeColor(b.medianFee) }} strokeWidth={b === tip ? 3 : 1.6} strokeLinecap="round" opacity={b === tip ? 1 : 0.85}>
                <title>{`Block ${b.height.toLocaleString("en-US")} · ${b.txCount.toLocaleString("en-US")} tx · ${b.pool ?? "unknown pool"} · median ${satvb(b.medianFee)}`}</title>
              </line>
            );
          })}
          {ghosts.map((g) => {
            const [x, y] = pos(g.blockTime, rMax + 2);
            return (
              <g key={g.id}>
                <rect x={x - 8} y={y - 8} width={16} height={16} style={{ fill: "var(--accent-soft)" }} />
                <circle cx={x} cy={y} r={3.2} style={{ fill: "var(--accent)" }}>
                  <title>{`Old coins woke up: ${btc(g.dormantSats)} in block ${g.blockHeight.toLocaleString("en-US")}`}</title>
                </circle>
              </g>
            );
          })}
          {/* Time since the last block, against the 10-minute average */}
          <circle cx={c} cy={c} r={arcR} fill="none" style={{ stroke: "var(--line)" }} strokeWidth={2} />
          <path
            d={`M ${c} ${c - arcR} A ${arcR} ${arcR} 0 ${progress > 0.5 ? 1 : 0} 1 ${arcEnd[0]} ${arcEnd[1]}`}
            fill="none"
            style={{ stroke: progress >= 1 ? "var(--accent)" : "var(--fg)" }}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <text x={c} y={c - 34} textAnchor="middle" className="obs-dial-k">
            {view === "simple" ? "Last block added" : "Tip"}
          </text>
          <text x={c} y={c + 6} textAnchor="middle" className="obs-dial-big">
            {tip ? (view === "simple" ? sinceShort(tip.time, now) : tip.height.toLocaleString("en-US")) : "…"}
          </text>
          <text x={c} y={c + 38} textAnchor="middle" className="obs-dial-k">
            {tip ? (view === "simple" ? `${inDay.length} blocks today${tip.pool ? ` · last by ${tip.pool}` : ""}` : `${sinceShort(tip.time, now)} · ${tip.txCount.toLocaleString("en-US")} tx · ${tip.pool ?? ""}`) : ""}
          </text>
        </svg>
        <div className="obs-key" aria-hidden="true">
          <span><i style={{ background: "var(--fg-4)" }} /> cheap</span>
          <span><i style={{ background: "var(--fg)" }} /> busy</span>
          <span><i style={{ background: "var(--accent)" }} /> fee spike</span>
          <span><i style={{ background: "var(--accent)", borderRadius: 9 }} /> old coins woke</span>
          <span>inner arc: time since last block (10 min average)</span>
        </div>
      </section>
  );
}
