"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { durationShort, monthYear } from "@/lib/domain/format";
import { classifyTx, type TxClass } from "@/lib/pulse/interest";
import { btc, compact, satvb, sinceShort, usd } from "@/lib/pulse/format";
import type { PulseBlock, PulseProjected } from "@/lib/pulse/types";
import { usePulse, useNow } from "@/lib/pulse/use-pulse";
import { EventLog } from "./event-log";
import { LabShell, useView } from "./shell";

const MAX_VSIZE = 1_000_000;

function feeTone(median: number) {
  if (median >= 20) return "hot";
  if (median >= 5) return "busy";
  if (median >= 2) return "warm";
  return "calm";
}

export function MachineConcept() {
  const p = usePulse();
  return (
    <LabShell concept="machine" price={p.pulse?.priceUsd ?? null}>
      <MachineStage {...p} />
    </LabShell>
  );
}

interface Drop { id: string; cls: TxClass; label: string | null; x: number; delay: number }

/** Queued blocks, the now line and mined blocks: reused by the terminal's Blocks tab. */
export function MachineFloor({ pulse, newTxs, newBlock, now }: Pick<ReturnType<typeof usePulse>, "pulse" | "newTxs" | "newBlock"> & { now: number }) {
  const view = useView();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [landed, setLanded] = useState<number | null>(null);

  useEffect(() => {
    if (!newTxs.txs.length) return;
    const fastest = pulse?.fees?.fastest ?? null;
    const batch = newTxs.txs.slice(0, 14).map((t, i) => {
      const cls = classifyTx(t, fastest);
      return { id: `${newTxs.batch}-${t.txid}`, cls, label: cls === "regular" ? null : btc(t.value), x: 10 + Math.random() * 80, delay: i * 0.22 };
    });
    const add = setTimeout(() => setDrops((d) => [...d, ...batch].slice(-40)), 0);
    const clear = setTimeout(() => setDrops((d) => d.filter((x) => !batch.includes(x))), 5200);
    return () => {
      clearTimeout(add);
      clearTimeout(clear);
    };
  }, [newTxs, pulse?.fees?.fastest]);

  useEffect(() => {
    if (!newBlock.block) return;
    const h = newBlock.block.height;
    const on = setTimeout(() => setLanded(h), 0);
    const off = setTimeout(() => setLanded(null), 2600);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [newBlock]);

  const projected = (pulse?.projected ?? []).slice(0, 3);
  const mined = (pulse?.blocks ?? []).slice(0, 4);
  const tip = mined[0];
  const since = tip ? now / 1000 - tip.time : 0;

  return (
    <section className="mac-floor" aria-label="Waiting blocks and mined blocks">
        <div className="mac-side mac-side--wait">
          <div className="mac-label">{view === "simple" ? "Waiting room" : "Mempool · projected blocks"}</div>
          <div className="mac-row mac-row--wait">
            {projected.slice().reverse().map((b, i, arr) => (
              <Cube key={`p-${i}`} kind="wait" fill={Math.min(1, b.vsize / MAX_VSIZE)} tone={feeTone(b.medianFee)} isNext={i === arr.length - 1}>
                <ProjectedFace b={b} n={arr.length - i} view={view} price={pulse?.priceUsd ?? null} />
              </Cube>
            ))}
            <div className="mac-drops" aria-hidden="true">
              {drops.map((d) => (
                <span key={d.id} className={`mac-drop mac-drop--${d.cls}`} style={{ left: `${d.x}%`, animationDelay: `${d.delay}s` }}>
                  {d.label && <em>{d.label}</em>}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mac-now" role="timer" aria-label={`${Math.floor(since / 60)} minutes since the last block`}>
          <span className="mac-now-k">now</span>
          <span className="mac-now-t num">{tip ? `${Math.floor(since / 60)}:${String(Math.floor(since % 60)).padStart(2, "0")}` : "…"}</span>
          <span className="mac-now-s">{view === "simple" ? "since the last block" : "since tip"}</span>
          <span className="mac-now-bar"><i style={{ height: `${Math.min(100, (since / 600) * 100)}%` }} /></span>
        </div>

        <div className="mac-side mac-side--done">
          <div className="mac-label">{view === "simple" ? "Added to the chain" : "Mined blocks"}</div>
          <div className="mac-row mac-row--done">
            {mined.map((b) => (
              <Cube key={b.height} kind="done" fill={Math.min(1, b.weight / 4_000_000)} tone={feeTone(b.medianFee)} landing={landed === b.height}>
                <MinedFace b={b} now={now} view={view} />
              </Cube>
            ))}
          </div>
        </div>
      </section>
  );
}

function MachineStage({ pulse, events, newTxs, newBlock }: ReturnType<typeof usePulse>) {
  const view = useView();
  const now = useNow();
  const projected = (pulse?.projected ?? []).slice(0, 3);
  const mined = (pulse?.blocks ?? []).slice(0, 4);
  const tip = mined[0];
  const ghosts = (pulse?.ghosts ?? []).slice(0, 3);

  return (
    <main className="mac" id="main">
      <header className="mac-head">
        <div className="idx">[ <em>Live</em> ] · How Bitcoin works, right now</div>
        <h1 className="mac-h">
          Transactions wait. <span className="dim">Miners pack them into blocks.</span> Blocks join the chain.
        </h1>
      </header>

      <MachineFloor pulse={pulse} newTxs={newTxs} newBlock={newBlock} now={now} />

      <section className="mac-lower">
        <div className="mac-explain">
          <div className="idx">[ <em>01</em> ] · {view === "simple" ? "In plain words" : "Readings"}</div>
          {view === "simple" ? (
            <p className="mac-p">
              {pulse?.mempool ? `${pulse.mempool.count.toLocaleString("en-US")} transactions` : "Transactions"} are waiting. Each block holds about{" "}
              {projected[0] ? compact(projected[0].nTx) : "a few thousand"}, so the queue ahead is at least {(pulse?.projected.length ?? 0) * 10} minutes long if nothing new arrives.
              {pulse?.fees && pulse.priceUsd ? ` Getting into the next block costs about ${usd(((pulse.fees.fastest * 140) / 1e8) * pulse.priceUsd, 2)} for a typical payment.` : ""}
            </p>
          ) : (
            <dl className="mac-tech">
              <div><dt>Fees</dt><dd>{pulse?.fees ? `${satvb(pulse.fees.fastest)} / ${satvb(pulse.fees.halfHour)} / ${satvb(pulse.fees.hour)}` : "—"}</dd></div>
              <div><dt>Mempool</dt><dd>{pulse?.mempool ? `${pulse.mempool.count.toLocaleString("en-US")} tx · ${(pulse.mempool.vsize / 1e6).toFixed(1)} vMB · ${btc(pulse.mempool.totalFee)} in fees` : "—"}</dd></div>
              <div><dt>Tip</dt><dd>{tip ? `${tip.height.toLocaleString("en-US")} · ${tip.pool ?? "unknown"} · reward ${btc(tip.reward)}` : "—"}</dd></div>
            </dl>
          )}

          {ghosts.length > 0 && (
            <div className="mac-ghosts">
              <div className="idx">[ <em>02</em> ] · Old coins that woke up</div>
              <ul>
                {ghosts.map((g) => (
                  <li key={g.id}>
                    <Link href={`/e/${g.id}`}>
                      <b className="num">{btc(g.dormantSats)}</b> from {monthYear(g.oldestCreatedTime)}
                      <span className="muted"> · slept {durationShort(g.oldestCreatedTime, g.blockTime).replace(/ \d+d$/, "")} · block {g.blockHeight.toLocaleString("en-US")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <aside className="mac-log" aria-label="What just happened">
          <div className="idx">[ <em>03</em> ] · Log</div>
          <EventLog events={events} now={now} price={pulse?.priceUsd ?? null} limit={10} />
        </aside>
      </section>
    </main>
  );
}

function Cube({ kind, fill, tone, isNext, landing, children }: { kind: "wait" | "done"; fill: number; tone: string; isNext?: boolean; landing?: boolean; children: React.ReactNode }) {
  return (
    <div className={`cube cube--${kind} cube--${tone}${isNext ? " cube--next" : ""}${landing ? " cube--landing" : ""}`} style={{ ["--fill" as string]: fill }}>
      <div className="cube-top" aria-hidden="true" />
      <div className="cube-side" aria-hidden="true" />
      <div className="cube-front">
        <span className="cube-fill" aria-hidden="true" />
        <div className="cube-text">{children}</div>
      </div>
    </div>
  );
}

function ProjectedFace({ b, n, view, price }: { b: PulseProjected; n: number; view: string; price: number | null }) {
  const mins = n * 10;
  return view === "simple" ? (
    <>
      <b>{n === 1 ? "Next block" : `In ~${mins} min`}</b>
      <span>{compact(b.nTx)} payments</span>
      <span className="muted">{price ? `~${usd(((b.medianFee * 140) / 1e8) * price, 2)} fee` : ""}</span>
    </>
  ) : (
    <>
      <b>+{n}</b>
      <span>{satvb(b.medianFee)} median</span>
      <span className="muted">{b.minFee.toFixed(1)}–{Math.round(b.maxFee)} sat/vB</span>
      <span className="muted">{b.nTx.toLocaleString("en-US")} tx</span>
    </>
  );
}

function MinedFace({ b, now, view }: { b: PulseBlock; now: number; view: string }) {
  return view === "simple" ? (
    <>
      <b className="num">{b.height.toLocaleString("en-US")}</b>
      <span>{b.pool ?? "Unknown miner"}</span>
      <span className="muted">{sinceShort(b.time, now)}</span>
    </>
  ) : (
    <>
      <b className="num">{b.height.toLocaleString("en-US")}</b>
      <span>{b.txCount.toLocaleString("en-US")} tx · {(b.size / 1e6).toFixed(2)} MB</span>
      <span className="muted">{satvb(b.medianFee)} · {btc(b.totalFees)}</span>
      <span className="muted">{b.pool ?? "?"} · {sinceShort(b.time, now)}</span>
    </>
  );
}
