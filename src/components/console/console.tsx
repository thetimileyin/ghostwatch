"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { durationShort, monthYear } from "@/lib/domain/format";
import { classifyTx, CLASS_COPY } from "@/lib/pulse/interest";
import { btc, compact, satvb, short, sinceShort, usd } from "@/lib/pulse/format";
import type { NodesSnapshot, Pulse, PulseBlock } from "@/lib/pulse/types";
import { usePulse, useNow, type LiveEvent } from "@/lib/pulse/use-pulse";
import { Dial } from "../lab/observatory";
import { MachineFloor } from "../lab/machine";
import { ViewCtx, useView, useViewPreference } from "../lab/view";
import { ChainBar } from "./chain-bar";
import { DotChart } from "./dot-chart";
import { FieldGuide } from "./field-guide";
import { Globe } from "./globe";
import { NetMap } from "./net-map";

const TYPICAL_VB = 140;
type Tab = "map" | "blocks" | "dial";

/** Nodes snapshot and ~24h of blocks, shared by the terminal views. */
export function useNetworkContext(tipHeight: number | undefined) {
  const [nodes, setNodes] = useState<NodesSnapshot | null>(null);
  const [day, setDay] = useState<PulseBlock[]>([]);
  useEffect(() => {
    fetch("/api/nodes")
      .then((r) => (r.ok ? r.json() : null))
      .then(setNodes)
      .catch(() => {});
  }, []);
  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout>;
    const load = () =>
      fetch("/api/blocks")
        .then((r) => (r.ok ? r.json() : []))
        .then((d: PulseBlock[]) => {
          if (!alive) return;
          if (d.length) setDay(d);
          else retry = setTimeout(load, 4000);
        })
        .catch(() => alive && (retry = setTimeout(load, 4000)));
    load();
    return () => {
      alive = false;
      clearTimeout(retry);
    };
  }, [tipHeight]);
  return { nodes, day };
}

/** Briefly marks the newest block in the timechain strip when it lands. */
export function useLanded(newBlock: { batch: number; block: PulseBlock | null }) {
  const [landed, setLanded] = useState<number | null>(null);
  useEffect(() => {
    if (!newBlock.block) return;
    const h = newBlock.block.height;
    const on = setTimeout(() => setLanded(h), 0);
    const off = setTimeout(() => setLanded(null), 4000);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [newBlock]);
  return landed;
}

export function Console() {
  const live = usePulse();
  const { pulse } = live;
  const [view, choose] = useViewPreference();
  const [tab, setTab] = useState<Tab>("map");
  const [projection, setProjection] = useState<"flat" | "globe">("flat");
  const [guide, setGuide] = useState(false);
  const now = useNow();
  const { nodes, day } = useNetworkContext(pulse?.blocks[0]?.height);
  const landed = useLanded(live.newBlock);
  const prev = useRef<Pulse | null>(null);
  const [delta, setDelta] = useState<{ mempool: number; price: number; blocks: number; notable: number } | null>(null);

  // What changed since the previous snapshot (every ~4 seconds).
  useEffect(() => {
    if (!pulse) return;
    const p = prev.current;
    if (p && p.serverTime !== pulse.serverTime) {
      const fastest = pulse.fees?.fastest ?? null;
      const seen = new Set(p.txs.map((t) => t.txid));
      const d = {
        mempool: (pulse.mempool?.count ?? 0) - (p.mempool?.count ?? 0),
        price: (pulse.priceUsd ?? 0) - (p.priceUsd ?? 0),
        blocks: (pulse.blocks[0]?.height ?? 0) - (p.blocks[0]?.height ?? 0),
        notable: pulse.txs.filter((t) => !seen.has(t.txid) && classifyTx(t, fastest) !== "regular").length,
      };
      setTimeout(() => setDelta(d), 0);
    }
    prev.current = pulse;
  }, [pulse]);

  return (
    <ViewCtx.Provider value={view}>
      <div className="gw" data-view={view}>
        <ChainBar pulse={pulse} nowMs={now} view={view} choose={choose} area="terminal" onGuide={() => setGuide(true)} landed={landed} />

        <aside className="gw-col gw-left" aria-label="Network readouts">
          <Vitals pulse={pulse} nodes={nodes} day={day} now={now} />
          <CoinInspector pulse={pulse} now={now} />
          <Miners pulse={pulse} />
        </aside>

        <main className="gw-center" id="main">
          <section className="gw-stage" aria-label="Main view">
            <div className="gw-tabs">
              <div role="tablist" aria-label="View" className="seg">
                {(
                  [
                    ["map", "Network"],
                    ["blocks", "Blocks"],
                    ["dial", "Last 24 hours"],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}>
                    {label}
                  </button>
                ))}
              </div>
              {tab === "map" && (
                <div className="seg" role="radiogroup" aria-label="Map projection">
                  {(["flat", "globe"] as const).map((p) => (
                    <button key={p} type="button" role="radio" aria-checked={projection === p} onClick={() => setProjection(p)}>
                      {p === "flat" ? "Flat" : "Globe"}
                    </button>
                  ))}
                </div>
              )}
              <span className="gw-tabs-hint">
                {tab === "map"
                  ? view === "simple"
                    ? "Where Bitcoin's nodes are. Lines show transactions spreading."
                    : `${nodes ? nodes.totalNodes.toLocaleString("en-US") : "…"} reachable nodes · arcs: sampled tx, random endpoints`
                  : tab === "blocks"
                    ? "Waiting blocks on the left, mined blocks on the right"
                    : "Every block from the last 24 hours"}
              </span>
            </div>
            <div className="gw-stage-body">
              {tab === "map" && projection === "flat" && <NetMap nodes={nodes} newTxs={live.newTxs} newBlock={live.newBlock} fastestFee={pulse?.fees?.fastest ?? null} />}
              {tab === "map" && projection === "globe" && <Globe nodes={nodes} newTxs={live.newTxs} newBlock={live.newBlock} fastestFee={pulse?.fees?.fastest ?? null} />}
              {tab === "blocks" && <MachineFloor pulse={pulse} newTxs={live.newTxs} newBlock={live.newBlock} now={now} />}
              {tab === "dial" && <Dial pulse={pulse} day={day} now={now} />}
            </div>
            {tab === "map" && (
              <div className="gw-legend" aria-label="Legend">
                <span><i className="lg-node" /> Node</span>
                <span><i className="lg-reg" /> Payment</span>
                <span><i className="lg-large" /> 10+ BTC</span>
                <span><i className="lg-whale" /> 100+ BTC</span>
                <span><i className="lg-rush" /> High fee</span>
                <span className="gw-legend-note">Every node lights up when a block is found{projection === "globe" ? " · drag to turn" : ""}</span>
              </div>
            )}
          </section>
          <div className="gw-lower">
            <PassingThrough pulse={pulse} now={now} />
            <PriceAndFees pulse={pulse} />
          </div>
        </main>

        <aside className="gw-col gw-right" aria-label="What's happening">
          <ChainLog events={live.events} now={now} price={pulse?.priceUsd ?? null} />
          <Pulse_ pulse={pulse} day={day} now={now} />
          <LastSeconds delta={delta} />
        </aside>

        {guide && <FieldGuide onClose={() => setGuide(false)} />}
      </div>
    </ViewCtx.Provider>
  );
}

export function Panel({ title, meta, tone, children, className = "" }: { title: string; meta?: ReactNode; tone?: "ice" | "ghost" | "warn"; children: ReactNode; className?: string }) {
  return (
    <section className={`pn ${className}`} aria-label={title}>
      <header className={`pn-h pn-h--${tone ?? "ice"}`}>
        <span className="pn-title">{title}</span>
        {meta != null && <span className="pn-meta">{meta}</span>}
      </header>
      <div className="pn-b">{children}</div>
    </section>
  );
}

// ───────── Left ─────────

function Row({ label, sub, value, tone }: { label: string; sub?: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rw">
      <span className={`rw-dot rw-dot--${tone ?? "c"}`} aria-hidden="true" />
      <span className="rw-l">
        {label}
        {sub && <em>{sub}</em>}
      </span>
      <span className="rw-v num">{value}</span>
    </div>
  );
}

function Vitals({ pulse, nodes, day, now }: { pulse: Pulse | null; nodes: NodesSnapshot | null; day: PulseBlock[]; now: number }) {
  const view = useView();
  const today = day.filter((b) => now / 1000 - b.time <= 86400).length;
  const feeUsd = pulse?.fees && pulse.priceUsd ? ((pulse.fees.fastest * TYPICAL_VB) / 1e8) * pulse.priceUsd : null;
  const ln = pulse?.network.lightning;
  return (
    <Panel title="Vitals" meta="live">
      <Row label={view === "simple" ? "Waiting to confirm" : "Mempool"} sub={view === "simple" ? "transactions" : pulse?.mempool ? `${(pulse.mempool.vsize / 1e6).toFixed(1)} vMB` : ""} value={pulse?.mempool ? compact(pulse.mempool.count) : "—"} />
      <Row label={view === "simple" ? "Cost to get in now" : "Next-block fee"} sub={view === "simple" ? "typical payment" : "sat/vB"} value={view === "simple" ? usd(feeUsd, 2) : pulse?.fees ? pulse.fees.fastest.toFixed(1) : "—"} tone={(pulse?.fees?.fastest ?? 0) >= 20 ? "w" : "c"} />
      <Row label="Blocks today" sub="last 24 hours" value={today || "—"} />
      <Row label={view === "simple" ? "Mining power" : "Hashrate"} sub="EH/s" value={pulse?.network.hashrateEh ? Math.round(pulse.network.hashrateEh).toLocaleString("en-US") : "—"} />
      <Row label="Reachable nodes" sub="public snapshot" value={nodes ? compact(nodes.totalNodes) : "—"} />
      <Row label="Lightning channels" sub={ln ? `as of ${ln.asOf.slice(0, 10)}` : ""} value={ln ? compact(ln.channels) : "—"} />
    </Panel>
  );
}

function Miners({ pulse }: { pulse: Pulse | null }) {
  const view = useView();
  const pools = pulse?.network.pools24h ?? [];
  return (
    <Panel title="Who's mining" meta="24 hours">
      {pools.slice(0, 6).map((p) => (
        <div key={p.name} className="rw rw--bar">
          <span className="rw-l">{p.name}</span>
          <span className="rw-bar" aria-hidden="true"><i style={{ width: `${Math.round(p.share * 100)}%` }} /></span>
          <span className="rw-v num">{view === "simple" ? `${Math.round(p.share * 100)}%` : `${p.blocks} · ${(p.share * 100).toFixed(1)}%`}</span>
        </div>
      ))}
      {pools.length === 0 && <p className="pn-empty">Loading…</p>}
    </Panel>
  );
}

// ───────── Dock ─────────

const AXIS_START = Date.UTC(2009, 0, 3) / 1000;

/** The selected waking coins, inspected: a sleep line from 2009 to now and the facts. */
function CoinInspector({ pulse, now }: { pulse: Pulse | null; now: number }) {
  const view = useView();
  const ghosts = pulse?.ghosts ?? [];
  const [sel, setSel] = useState<string | null>(null);
  const g = ghosts.find((x) => x.id === sel) ?? ghosts[0];
  const today = ghosts.filter((x) => now / 1000 - x.blockTime < 86400).length;
  const span = now / 1000 - AXIS_START;
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - AXIS_START) / span) * 100));
  return (
    <Panel title="Waking coins" meta={`${today} today`} tone="ghost" className="dk dk-coin">
      {!g ? (
        <p className="pn-empty">No old coins have moved since the detector started.</p>
      ) : (
        <>
          <div className="ci-top">
            <span className="ci-amt num">{btc(g.dormantSats)}</span>
            <Link href={`/e/${g.id}`} className="ci-open">Evidence</Link>
          </div>
          <div className="ci-track" role="img" aria-label={`Unspent from ${monthYear(g.oldestCreatedTime)} until block ${g.blockHeight}`}>
            <span className="ci-seg" style={{ left: `${pct(g.oldestCreatedTime)}%`, right: `${100 - pct(g.blockTime)}%` }} />
            <span className="ci-ax"><b>2009</b><b>now</b></span>
          </div>
          <dl className="ci-dl">
            <div><dt>Unspent since</dt><dd>{monthYear(g.oldestCreatedTime)}</dd></div>
            <div><dt>Slept</dt><dd className="hot">{durationShort(g.oldestCreatedTime, g.blockTime).replace(/ \d+d$/, "")}</dd></div>
            <div><dt>Moved</dt><dd>{sinceShort(g.blockTime, now)}</dd></div>
            <div><dt>{view === "simple" ? "Block" : "Height"}</dt><dd>{g.blockHeight.toLocaleString("en-US")}</dd></div>
          </dl>
          {ghosts.length > 1 && (
            <ol className="ci-list" aria-label="Other recent awakenings">
              {ghosts.slice(0, 6).map((x) => (
                <li key={x.id}>
                  <button type="button" aria-pressed={x.id === g.id} onClick={() => setSel(x.id)}>
                    <span className="num">{btc(x.dormantSats)}</span>
                    <span>{durationShort(x.oldestCreatedTime, x.blockTime).replace(/ \d+m \d+d$/, "")}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Panel>
  );
}

function PassingThrough({ pulse, now }: { pulse: Pulse | null; now: number }) {
  const view = useView();
  const txs = pulse?.txs.slice(0, 18) ?? [];
  const fastest = pulse?.fees?.fastest ?? null;
  return (
    <Panel title="Passing through" meta={`${pulse?.txs.length ?? 0} sampled`} className="gw-ticker">
      <ol className="tk">
        {txs.map((t) => {
          const cls = classifyTx(t, fastest);
          return (
            <li key={t.txid} className={`tk-i tk-i--${cls}`}>
              <a href={`https://mempool.space/tx/${t.txid}`} target="_blank" rel="noopener noreferrer">
                <span className="tk-t">{sinceShort(t.seenAt / 1000, now)}</span>
                <span className="tk-a num">{btc(t.value)}</span>
                <span className="tk-m">{view === "simple" ? (cls === "regular" ? (pulse?.priceUsd ? usd((t.value / 1e8) * pulse.priceUsd) : "") : CLASS_COPY[cls].tag) : `${satvb(t.feeRate)} · ${short(t.txid, 4)}`}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function PriceAndFees({ pulse }: { pulse: Pulse | null }) {
  const view = useView();
  const price = pulse?.priceUsd ?? null;
  const past = pulse?.network.price24hAgo ?? null;
  const ch = price && past ? (price - past) / past : null;
  const tiles: { k: string; v: string; s?: string; tone?: "up" | "down" | "hot" }[] = [
    { k: "Bitcoin", v: usd(price), s: ch != null ? `${ch >= 0 ? "+" : "−"}${Math.abs(ch * 100).toFixed(2)}% in 24h` : "", tone: ch == null ? undefined : ch >= 0 ? "up" : "down" },
    { k: view === "simple" ? "$1 buys" : "Sats per dollar", v: price ? Math.round(1e8 / price).toLocaleString("en-US") : "—", s: "sats" },
    { k: view === "simple" ? "Next-block fee" : "Fastest", v: pulse?.fees ? satvb(pulse.fees.fastest) : "—", s: pulse?.fees ? `within an hour: ${satvb(pulse.fees.hour)}` : "", tone: (pulse?.fees?.fastest ?? 0) >= 20 ? "hot" : undefined },
    { k: view === "simple" ? "Queue size" : "Mempool", v: pulse?.mempool ? `${(pulse.mempool.vsize / 1e6).toFixed(1)} vMB` : "—", s: pulse?.mempool ? `${btc(pulse.mempool.totalFee)} in fees` : "" },
    { k: view === "simple" ? "Mining power" : "Hashrate", v: pulse?.network.hashrateEh ? `${Math.round(pulse.network.hashrateEh)} EH/s` : "—", s: pulse?.network.difficulty ? `difficulty ${compact(pulse.network.difficulty)}` : "" },
    { k: "Lightning", v: pulse?.network.lightning ? btc(pulse.network.lightning.capacitySats) : "—", s: pulse?.network.lightning ? `${compact(pulse.network.lightning.nodes)} nodes` : "" },
  ];
  return (
    <Panel title="Price and fees" meta="live" className="gw-market">
      <div className="mk">
        {tiles.map((t) => (
          <div key={t.k} className={`mk-t${t.tone === "hot" ? " mk-t--hot" : ""}`}>
            <div className="mk-k">{t.k}</div>
            <div className="mk-v num">{t.v}</div>
            <div className={`mk-s${t.tone === "up" || t.tone === "down" ? ` mk-s--${t.tone}` : ""}`}>{t.s}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const KIND: Record<string, { label: string; cls: string }> = {
  block: { label: "New block", cls: "k-block" },
  ghost: { label: "Waking coins", cls: "k-ghost" },
  whale: { label: "100+ BTC", cls: "k-whale" },
  large: { label: "10+ BTC", cls: "k-large" },
  rush: { label: "High fee", cls: "k-rush" },
};

/** Alert feed of notable events. Waking coins are the one orange row. */
export function ChainLog({ events, now, price, limit = 30 }: { events: LiveEvent[]; now: number; price: number | null; limit?: number }) {
  const view = useView();
  return (
    <Panel title="Chain log" meta={`${events.length} events`} className="gw-stream">
        <ol className="ss">
          {events.slice(0, limit).map((e) => {
            const kind = e.kind === "tx" ? KIND[e.cls] : KIND[e.kind];
            let text = "", sub = "", href = "", external = true;
            if (e.kind === "block") {
              const b = e.block;
              text = view === "simple" ? `Block added${b.pool ? ` by ${b.pool}` : ""}` : `${b.height.toLocaleString("en-US")} · ${b.pool ?? "unknown"}`;
              sub = view === "simple" ? `${b.txCount.toLocaleString("en-US")} transactions confirmed` : `${b.txCount.toLocaleString("en-US")} tx · ${btc(b.totalFees)} fees · median ${satvb(b.medianFee)}`;
              href = `https://mempool.space/block/${b.hash}`;
            } else if (e.kind === "ghost") {
              const g = e.ghost;
              text = `${btc(g.dormantSats)} from ${monthYear(g.oldestCreatedTime)}`;
              sub = `unspent ${durationShort(g.oldestCreatedTime, g.blockTime).replace(/ \d+d$/, "")}`;
              href = `/e/${g.id}`;
              external = false;
            } else {
              const t = e.tx;
              text = view === "simple" ? CLASS_COPY[e.cls].simple : short(t.txid, 6);
              sub = view === "simple" ? `${btc(t.value)}${price ? ` · ${usd((t.value / 1e8) * price)}` : ""}` : `outputs ${btc(t.value)} · ${satvb(t.feeRate)} · ${t.vsize} vB`;
              href = `https://mempool.space/tx/${t.txid}`;
            }
            const body = (
              <>
                <span className="ss-time num">{sinceShort(e.at / 1000, now)}</span>
                <span className="ss-body">
                  <b>{text}</b>
                  <span className="ss-sub">{sub}</span>
                </span>
                <span className={`ss-kind ${kind.cls}`}>{kind.label}</span>
              </>
            );
            return (
              <li key={e.key} className={`ss-i ${kind.cls}${e.fresh ? " is-fresh" : ""}`}>
                {external ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">{body}</a>
                ) : (
                  <Link href={href}>{body}</Link>
                )}
              </li>
            );
          })}
          {events.length === 0 && <li className="pn-empty">Listening to the network…</li>}
        </ol>
    </Panel>
  );
}

// ───────── Right: pulse ─────────

function Meter({ label, value, max, text, tone }: { label: string; value: number; max: number; text: string; tone?: string }) {
  const cells = 16;
  const on = Math.round(Math.min(1, value / max) * cells);
  return (
    <div className="sc">
      <span className="sc-l">{label}</span>
      <span className={`sc-b${tone ? ` sc-b--${tone}` : ""}`} aria-hidden="true">
        {Array.from({ length: cells }, (_, i) => <i key={i} className={i < on ? "on" : ""} />)}
      </span>
      <span className="sc-v num">{text}</span>
    </div>
  );
}

function Pulse_({ pulse, day, now }: { pulse: Pulse | null; day: PulseBlock[]; now: number }) {
  const view = useView();
  const fastest = pulse?.fees?.fastest ?? null;
  const notable = (pulse?.txs ?? []).filter((t) => classifyTx(t, fastest) !== "regular").length;
  const hour = day.filter((b) => now / 1000 - b.time <= 3600).length;
  const ghosts24 = (pulse?.ghosts ?? []).filter((g) => now / 1000 - g.blockTime < 86400).length;
  const count = pulse?.mempool?.count ?? 0;
  const fees = [...day].sort((a, b) => a.time - b.time).map((b) => b.medianFee);
  return (
    <Panel title="Pulse" meta="now">
      <Meter label={view === "simple" ? "Queue" : "Mempool tx"} value={count} max={300_000} text={compact(count)} />
      <Meter label={view === "simple" ? "Fee pressure" : "Fastest fee"} value={fastest ?? 0} max={50} text={fastest != null ? satvb(fastest) : "—"} tone={(fastest ?? 0) >= 20 ? "hot" : undefined} />
      <Meter label={view === "simple" ? "Blocks this hour" : "Blocks / 1h"} value={hour} max={6} text={`${hour} of ~6`} />
      <Meter label={view === "simple" ? "Big moves seen" : "Notable tx"} value={notable} max={20} text={String(notable)} />
      <Meter label={view === "simple" ? "Old coins moved" : "Ghosts / 24h"} value={ghosts24} max={20} text={String(ghosts24)} tone="hot" />
      <DotChart values={fees} label="Median fee per block over the last 24 hours, sat/vB" axis={["24h ago", "now"]} format={(n) => `${n.toFixed(1)}`} />
      <p className="dk-note">{view === "simple" ? "Typical fee per block, last 24 hours" : "Median fee rate per block (sat/vB), 24h"}</p>
    </Panel>
  );
}

function LastSeconds({ delta }: { delta: { mempool: number; price: number; blocks: number; notable: number } | null }) {
  const s = (n: number, f: (n: number) => string) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${f(Math.abs(n))}`;
  return (
    <Panel title="Last few seconds" meta={delta ? (delta.blocks > 0 ? "new block" : "steady") : "waiting"}>
      {delta ? (
        <ul className="sd">
          <li><span>Waiting transactions</span><b className={delta.mempool < 0 ? "down" : ""}>{s(delta.mempool, (n) => n.toLocaleString("en-US"))}</b></li>
          <li><span>Price</span><b className={delta.price < 0 ? "down" : ""}>{s(delta.price, (n) => usd(n))}</b></li>
          <li><span>New blocks</span><b>{delta.blocks}</b></li>
          <li><span>New big moves</span><b>{delta.notable}</b></li>
        </ul>
      ) : (
        <p className="pn-empty">Comparing with the next update…</p>
      )}
    </Panel>
  );
}
