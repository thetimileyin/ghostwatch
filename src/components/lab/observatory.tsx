"use client";

import { useEffect, useMemo, useState } from "react";
import { btc, satvb, sinceShort, usd, vmb } from "@/lib/pulse/format";
import type { PulseBlock } from "@/lib/pulse/types";
import { usePulse, useNow } from "@/lib/pulse/use-pulse";
import { EventLog } from "./event-log";
import { LabShell, useView } from "./shell";

const DAY = 86400;
const TYPICAL_VB = 140; // a simple one-input, two-output payment

function feeColor(median: number): string {
  // dim ice for cheap blocks, signal cyan in the middle, amber when fees spike
  if (median >= 20) return "var(--accent)";
  if (median >= 5) return "var(--fg)";
  if (median >= 2) return "var(--fg-3)";
  return "var(--fg-4)";
}

export function ObservatoryConcept() {
  const { pulse, events } = usePulse();
  const [day, setDay] = useState<PulseBlock[]>([]);
  const tipHeight = pulse?.blocks[0]?.height;
  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout>;
    const load = () =>
      fetch("/api/blocks")
        .then((r) => (r.ok ? r.json() : []))
        .then((d: PulseBlock[]) => {
          if (!alive) return;
          if (d.length) setDay(d);
          else retry = setTimeout(load, 4000); // history still warming up
        })
        .catch(() => alive && (retry = setTimeout(load, 4000)));
    load();
    return () => {
      alive = false;
      clearTimeout(retry);
    };
  }, [tipHeight]);

  return (
    <LabShell concept="observatory" price={pulse?.priceUsd ?? null}>
      <ObservatoryStage pulse={pulse} events={events} day={day} />
    </LabShell>
  );
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

function ObservatoryStage({ pulse, events, day }: { pulse: ReturnType<typeof usePulse>["pulse"]; events: ReturnType<typeof usePulse>["events"]; day: PulseBlock[] }) {
  const view = useView();
  const now = useNow();
  const nowS = now / 1000;
  const inDay = useMemo(() => day.filter((b) => nowS - b.time <= DAY), [day, nowS]);
  const fees24 = inDay.reduce((s, b) => s + b.totalFees, 0);
  const tx24 = inDay.reduce((s, b) => s + b.txCount, 0);
  const typicalFeeUsd = pulse?.fees && pulse.priceUsd ? ((pulse.fees.fastest * TYPICAL_VB) / 1e8) * pulse.priceUsd : null;

  return (
    <main className="obs" id="main">
      <section className="obs-left" aria-label="Instruments">
        <div className="idx">[ <em>01</em> ] · Instruments</div>
        <div className="obs-read">
          <div className="obs-big num">{usd(pulse?.priceUsd ?? null)}</div>
          <div className="obs-l">Bitcoin price</div>
        </div>
        {view === "simple" ? (
          <>
            <div className="obs-read">
              <div className="obs-big num">{pulse?.mempool ? pulse.mempool.count.toLocaleString("en-US") : "—"}</div>
              <div className="obs-l">Transactions waiting to be confirmed</div>
            </div>
            <div className="obs-read">
              <div className="obs-big num">{typicalFeeUsd != null ? usd(typicalFeeUsd, 2) : "—"}</div>
              <div className="obs-l">To send a typical payment in the next block</div>
            </div>
            <p className="obs-note">
              Bitcoin adds a block of transactions about every 10 minutes. The dial shows every block from the last 24 hours. Longer marks held
              more transactions; brighter marks paid higher fees.
            </p>
          </>
        ) : (
          <dl className="obs-tech">
            <div><dt>Mempool</dt><dd>{pulse?.mempool ? `${pulse.mempool.count.toLocaleString("en-US")} tx · ${vmb(pulse.mempool.vsize)}` : "—"}</dd></div>
            <div><dt>Next block</dt><dd>{pulse?.fees ? satvb(pulse.fees.fastest) : "—"}</dd></div>
            <div><dt>30 min</dt><dd>{pulse?.fees ? satvb(pulse.fees.halfHour) : "—"}</dd></div>
            <div><dt>1 hour</dt><dd>{pulse?.fees ? satvb(pulse.fees.hour) : "—"}</dd></div>
            <div><dt>Minimum</dt><dd>{pulse?.fees ? satvb(pulse.fees.minimum) : "—"}</dd></div>
            <div><dt>24h blocks</dt><dd>{inDay.length} · {(inDay.length ? 86400 / inDay.length / 60 : 0).toFixed(1)} min avg</dd></div>
            <div><dt>24h tx</dt><dd>{tx24.toLocaleString("en-US")}</dd></div>
            <div><dt>24h fees</dt><dd>{btc(fees24)}</dd></div>
          </dl>
        )}
      </section>

      <Dial pulse={pulse} day={day} now={now} />

      <aside className="obs-right" aria-label="What just happened">
        <div className="idx">[ <em>02</em> ] · Log</div>
        <EventLog events={events} now={now} price={pulse?.priceUsd ?? null} limit={16} />
      </aside>
    </main>
  );
}
