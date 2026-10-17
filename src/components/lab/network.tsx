"use client";

import { useEffect, useRef, useState } from "react";
import { classifyTx, type TxClass } from "@/lib/pulse/interest";
import { btc, compact, satvb, short, sinceShort, vmb } from "@/lib/pulse/format";
import type { NodesSnapshot, PulseTx } from "@/lib/pulse/types";
import { usePulse, useNow } from "@/lib/pulse/use-pulse";
import { EventLog } from "./event-log";
import { LabShell, useView } from "./shell";

const COLORS: Record<TxClass | "ghost", string> = {
  regular: "127,169,198",
  large: "127,230,245",
  whale: "234,251,255",
  rush: "242,196,109",
  ghost: "169,155,255",
};

interface Particle {
  x: number; y: number; tx: number; ty: number;
  a: number; r: number; band: number; speed: number;
  size: number; cls: TxClass | "ghost"; born: number; label: string | null; dying: number | null;
}

export function NetworkConcept() {
  const p = usePulse();
  return (
    <LabShell concept="network" price={p.pulse?.priceUsd ?? null}>
      <NetworkStage {...p} />
    </LabShell>
  );
}

function NetworkStage({ pulse, events, newTxs, newBlock }: ReturnType<typeof usePulse>) {
  const view = useView();
  const now = useNow();
  const canvas = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const shock = useRef<{ at: number; label: string } | null>(null);
  const nodesRef = useRef<NodesSnapshot | null>(null);
  const [nodes, setNodes] = useState<NodesSnapshot | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fetch("/api/nodes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: NodesSnapshot | null) => {
        nodesRef.current = d;
        setNodes(d);
      })
      .catch(() => {});
  }, []);

  // New transactions become particles drifting into the waiting cloud.
  useEffect(() => {
    const c = canvas.current;
    if (!c || newTxs.txs.length === 0) return;
    const w = c.clientWidth, h = c.clientHeight;
    const fastest = pulse?.fees?.fastest ?? null;
    const seed = newTxs.batch === 1;
    newTxs.txs.forEach((t: PulseTx, i) => {
      const cls = classifyTx(t, fastest);
      const edge = Math.random() * Math.PI * 2;
      // The first batch is what's already waiting: place it in the cloud. Later ones fly in.
      const R = seed ? Math.min(w, h) * 0.42 * (0.2 + Math.random() * 0.6) : Math.max(w, h) * 0.7;
      particles.current.push({
        x: w / 2 + Math.cos(edge) * R, y: h / 2 + Math.sin(edge) * R * (seed ? 0.62 : 1), tx: 0, ty: 0,
        a: edge, r: 0, band: 0.18 + Math.random() * 0.62, speed: (0.0006 + Math.random() * 0.0016) * (Math.random() < 0.5 ? 1 : -1),
        size: Math.min(8, 1.6 + Math.log10(1 + t.value / 1e6)), cls, born: performance.now() + (seed ? 0 : i * 90),
        label: cls === "regular" ? null : btc(t.value), dying: null,
      });
    });
    if (particles.current.length > 700) particles.current.splice(0, particles.current.length - 700);
  }, [newTxs, pulse?.fees?.fastest]);

  // A new block pulls part of the cloud into the centre: it was confirmed.
  useEffect(() => {
    if (!newBlock.block) return;
    const share = Math.min(0.85, newBlock.block.txCount / Math.max(1, (pulse?.mempool?.count ?? 0) + newBlock.block.txCount));
    const alive = particles.current.filter((p) => p.dying == null);
    alive.sort((a, b) => a.born - b.born).slice(0, Math.max(8, Math.round(alive.length * share * 3))).forEach((p) => (p.dying = performance.now()));
    shock.current = { at: performance.now(), label: `Block ${newBlock.block.height.toLocaleString("en-US")}` };
  }, [newBlock, pulse?.mempool?.count]);

  // Fresh ghosts get a distinct, slower particle.
  useEffect(() => {
    const c = canvas.current;
    const g = events.find((e) => e.kind === "ghost" && e.fresh);
    if (!c || !g || g.kind !== "ghost") return;
    particles.current.push({
      x: c.clientWidth / 2, y: -20, tx: 0, ty: 0, a: Math.PI / 2, r: 0, band: 0.5, speed: 0.0004, size: 8,
      cls: "ghost", born: performance.now(), label: `${btc(g.ghost.dormantSats)} woke up`, dying: null,
    });
  }, [events]);

  // Render loop.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const t = performance.now();

      // Node map: equirectangular projection, ambient.
      const n = nodesRef.current;
      if (n) {
        // Equirectangular, aspect-correct (2:1), centred; latitudes beyond ±62° cropped.
        const mw = Math.min(w * 1.04, h * 2.6);
        const mh = mw / 2;
        const ox = (w - mw) / 2, oy = (h - mh) / 2 + mh * 0.06;
        ctx.fillStyle = "rgba(150,190,230,0.32)";
        for (const [lat, lng] of n.points) {
          const x = ox + ((lng + 180) / 360) * mw;
          const y = oy + ((90 - lat) / 180) * mh;
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }

      const cx = w / 2, cy = h / 2;
      const ring = Math.min(w, h) * 0.42;

      // Waiting cloud glow.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, ring);
      glow.addColorStop(0, "rgba(127,230,245,0.10)");
      glow.addColorStop(1, "rgba(127,230,245,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, ring, 0, Math.PI * 2); ctx.fill();

      // Block shockwave.
      if (shock.current) {
        const k = (t - shock.current.at) / 1600;
        if (k < 1) {
          ctx.strokeStyle = `rgba(234,251,255,${0.6 * (1 - k)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(cx, cy, 20 + k * ring * 1.3, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = `rgba(234,251,255,${1 - k})`;
          ctx.font = "500 13px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.fillText(shock.current.label, cx, cy + 4);
        } else shock.current = null;
      }

      const list = particles.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (t < p.born) continue;
        p.a += p.speed * (reduced.current ? 0 : 16);
        p.r = ring * p.band;
        p.tx = cx + Math.cos(p.a) * p.r;
        p.ty = cy + Math.sin(p.a) * p.r * 0.62;
        let alpha = 0.85;
        if (p.dying != null) {
          const k = Math.min(1, (t - p.dying) / 900);
          p.tx = p.x + (cx - p.x) * k;
          p.ty = p.y + (cy - p.y) * k;
          alpha = 1 - k;
          if (k >= 1) { list.splice(i, 1); continue; }
        }
        p.x += (p.tx - p.x) * (reduced.current ? 1 : 0.06);
        p.y += (p.ty - p.y) * (reduced.current ? 1 : 0.06);
        const col = COLORS[p.cls];
        if (p.cls !== "regular") {
          ctx.fillStyle = `rgba(${col},${0.12 * alpha})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = `rgba(${col},${alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); ctx.fill();
        if (p.label && t - p.born < 9000) {
          ctx.fillStyle = `rgba(${col},${Math.max(0, 1 - (t - p.born) / 9000)})`;
          ctx.font = "12px ui-monospace, monospace";
          ctx.textAlign = "left";
          ctx.fillText(p.label, p.x + 10, p.y - 8);
        }
      }
      if (!reduced.current) raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => reduced.current && draw();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const tip = pulse?.blocks[0];
  const waiting = pulse?.mempool?.count ?? null;
  const nextTake = pulse?.projected[0]?.nTx ?? null;

  return (
    <main className="net" id="main">
      <canvas ref={canvas} className="net-canvas" aria-hidden="true" />

      <section className="net-read" aria-label="Bitcoin right now">
        <div className="idx">[ <em>Live</em> ] · Bitcoin right now</div>
        {view === "simple" ? (
          <>
            <h1 className="net-h">
              {waiting != null ? `${waiting.toLocaleString("en-US")} transactions` : "Transactions"} are waiting.
              <span className="dim"> The next block takes about {nextTake != null ? compact(nextTake) : "…"} of them.</span>
            </h1>
            <p className="net-sub">
              {tip ? `Last block added ${sinceShort(tip.time, now)}${tip.pool ? ` by ${tip.pool}` : ""}. ` : ""}A new one arrives about every 10 minutes.
            </p>
          </>
        ) : (
          <dl className="net-tech">
            <div><dt>Mempool</dt><dd>{waiting != null ? waiting.toLocaleString("en-US") : "—"} tx · {pulse?.mempool ? vmb(pulse.mempool.vsize) : "—"}</dd></div>
            <div><dt>Fees</dt><dd>{pulse?.fees ? `${satvb(pulse.fees.fastest)} next · ${satvb(pulse.fees.halfHour)} 30m · ${satvb(pulse.fees.hour)} 1h` : "—"}</dd></div>
            <div><dt>Projected</dt><dd>{pulse ? `${pulse.projected.length} blocks queued · next median ${satvb(pulse.projected[0]?.medianFee ?? 0)}` : "—"}</dd></div>
            <div><dt>Tip</dt><dd>{tip ? `${tip.height.toLocaleString("en-US")} · ${short(tip.hash, 5)} · ${sinceShort(tip.time, now)}` : "—"}</dd></div>
          </dl>
        )}
      </section>

      <aside className="net-log" aria-label="What just happened">
        <div className="idx">[ <em>Log</em> ] · What just happened</div>
        <EventLog events={events} now={now} price={pulse?.priceUsd ?? null} />
      </aside>

      <footer className="net-foot">
        <div className="net-legend" aria-label="Legend">
          <span><i style={{ background: `rgb(${COLORS.regular})` }} /> Payment</span>
          <span><i style={{ background: `rgb(${COLORS.large})` }} /> 10+ BTC</span>
          <span><i style={{ background: `rgb(${COLORS.whale})` }} /> 100+ BTC</span>
          <span><i style={{ background: `rgb(${COLORS.rush})` }} /> High fee</span>
          <span><i style={{ background: `rgb(${COLORS.ghost})` }} /> Old coins waking</span>
        </div>
        <p className="net-caption">
          Dots in the background: {nodes ? `${nodes.totalNodes.toLocaleString("en-US")} reachable Bitcoin nodes` : "Bitcoin nodes"} (locations of nodes, not of transactions).
          {view === "technical" ? " Particles are a live sample of broadcast transactions, not every one." : ""}
        </p>
      </footer>
    </main>
  );
}
