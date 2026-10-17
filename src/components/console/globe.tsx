"use client";

import { useEffect, useRef } from "react";
import { LAND_DOTS } from "@/lib/geo/land-dots";
import { classifyTx, type TxClass } from "@/lib/pulse/interest";
import { btc } from "@/lib/pulse/format";
import type { NodesSnapshot, PulseBlock, PulseTx } from "@/lib/pulse/types";
import { palette, type Palette } from "@/lib/theme/theme";

const RAD = Math.PI / 180;
const arcRgb = (p: Palette, c: TxClass) => (c === "rush" ? p.accent : c === "whale" ? p.fg : c === "large" ? p.fg2 : p.fg3);

type V3 = [number, number, number];
const toV = (lat: number, lng: number): V3 => [Math.cos(lat * RAD) * Math.cos(lng * RAD), Math.cos(lat * RAD) * Math.sin(lng * RAD), Math.sin(lat * RAD)];

function slerp(a: V3, b: V3, t: number): V3 {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const om = Math.acos(dot);
  if (om < 1e-6) return a;
  const s = Math.sin(om), k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

interface Arc { a: V3; b: V3; start: number; dur: number; cls: TxClass; label: string | null }

/**
 * Dotted globe: land from Natural Earth, glowing points at real reachable-node
 * locations, transactions as lifted great-circle arcs between random nodes
 * (an illustration of relay, not real endpoints). Drag to turn it.
 */
export function Globe({
  nodes,
  newTxs,
  newBlock,
  fastestFee,
  labels = true,
}: {
  nodes: NodesSnapshot | null;
  newTxs: { batch: number; txs: PulseTx[] };
  newBlock: { batch: number; block: PulseBlock | null };
  fastestFee: number | null;
  labels?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const arcs = useRef<Arc[]>([]);
  const flash = useRef<{ at: number; label: string } | null>(null);
  const nodesRef = useRef<V3[]>([]);
  const rot = useRef({ lng: -20, lat: 22, drag: null as null | { x: number; y: number; lng: number; lat: number }, idleAt: 0 });

  useEffect(() => {
    nodesRef.current = (nodes?.points ?? []).map(([lat, lng]) => toV(lat, lng));
  }, [nodes]);

  useEffect(() => {
    const pts = nodes?.points;
    if (!pts?.length || !newTxs.txs.length) return;
    const now = performance.now();
    const txs = newTxs.batch === 1 ? newTxs.txs.slice(0, 20) : newTxs.txs;
    const spread = 3800 / Math.max(1, txs.length);
    txs.forEach((t, i) => {
      const a = pts[Math.floor(Math.random() * pts.length)];
      let b = pts[Math.floor(Math.random() * pts.length)];
      for (let k = 0; k < 6 && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 30; k++) b = pts[Math.floor(Math.random() * pts.length)];
      const cls = classifyTx(t, fastestFee);
      arcs.current.push({ a: toV(a[0], a[1]), b: toV(b[0], b[1]), start: now + i * spread, dur: cls === "regular" ? 1700 : 2800, cls, label: cls === "regular" ? null : btc(t.value) });
    });
    if (arcs.current.length > 120) arcs.current.splice(0, arcs.current.length - 120);
  }, [newTxs, nodes, fastestFee]);

  useEffect(() => {
    if (newBlock.block) flash.current = { at: performance.now(), label: `Block ${newBlock.block.height.toLocaleString("en-US")}${newBlock.block.pool ? ` · ${newBlock.block.pool}` : ""}` };
  }, [newBlock]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const land: V3[] = [];
    for (let i = 0; i < LAND_DOTS.length; i += 2) land.push(toV(LAND_DOTS[i], LAND_DOTS[i + 1]));
    let raf = 0;
    let last = performance.now();

    const down = (e: PointerEvent) => {
      rot.current.drag = { x: e.clientX, y: e.clientY, lng: rot.current.lng, lat: rot.current.lat };
      c.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const d = rot.current.drag;
      if (!d) return;
      rot.current.lng = d.lng - (e.clientX - d.x) * 0.35;
      rot.current.lat = Math.max(-60, Math.min(70, d.lat + (e.clientY - d.y) * 0.25));
      if (reduced) draw();
    };
    const up = () => {
      rot.current.drag = null;
      rot.current.idleAt = performance.now();
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);

    function draw() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = c!.clientWidth, H = c!.clientHeight;
      if (c!.width !== Math.round(W * dpr) || c!.height !== Math.round(H * dpr)) {
        c!.width = Math.round(W * dpr);
        c!.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const t = performance.now();
      const dt = t - last;
      last = t;
      const r = rot.current;
      if (!reduced && !r.drag && t - r.idleAt > 1500) r.lng -= dt * 0.004;

      const R = Math.min(W, H) * 0.42, cx = W / 2, cy = H / 2;
      const l0 = r.lng * RAD, p0 = r.lat * RAD;
      const cl = Math.cos(l0), sl = Math.sin(l0), cp = Math.cos(p0), sp = Math.sin(p0);
      // Rotate a unit vector into view space: returns [screenX, screenY, depth]
      const proj = (v: V3, s = 1): [number, number, number] => {
        const x = v[0] * cl + v[1] * sl;
        const y = -v[0] * sl + v[1] * cl;
        const z = v[2];
        const depth = x * cp + z * sp;
        const up = -x * sp + z * cp;
        return [cx + y * R * s, cy - up * R * s, depth];
      };

      // Sphere: a flat disc with a hairline rim, like a drawn instrument
      const P = palette();
      ctx.fillStyle = `rgba(${P.bg},0.6)`;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      const f = flash.current;
      const fk = f ? Math.max(0, 1 - (t - f.at) / 1800) : 0;
      if (f && fk === 0) flash.current = null;
      ctx.strokeStyle = fk > 0 ? `rgba(${P.accent},${0.3 + 0.6 * fk})` : `rgba(${P.fg},0.28)`;
      ctx.lineWidth = 1 + fk;
      ctx.stroke();

      // Land dots
      for (const v of land) {
        const [x, y, d] = proj(v);
        if (d <= 0) continue;
        ctx.fillStyle = `rgba(${P.fg3},${0.1 + 0.45 * d})`;
        ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
      }

      // Nodes
      for (const v of nodesRef.current) {
        const [x, y, d] = proj(v);
        if (d <= 0.02) continue;
        if (fk > 0) {
          ctx.fillStyle = `rgba(${P.accent},${0.35 * fk * d})`;
          ctx.fillRect(x - 2 - 3 * fk, y - 2 - 3 * fk, 4 + 6 * fk, 4 + 6 * fk);
        }
        if (P.dark) {
          ctx.fillStyle = `rgba(${P.fg},${0.028 * d})`;
          ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
        }
        ctx.fillStyle = `rgba(${P.fg},${0.7 * d})`;
        ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      }

      // Arcs
      const list = arcs.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const a = list[i];
        const k = (t - a.start) / a.dur;
        if (k < 0) continue;
        if (k > 1.6) {
          list.splice(i, 1);
          continue;
        }
        const head = Math.min(1, k);
        const fade = k > 1 ? 1 - (k - 1) / 0.6 : 1;
        const rgb = arcRgb(P, a.cls);
        ctx.strokeStyle = `rgba(${rgb},${(a.cls === "regular" ? 0.45 : 0.85) * fade})`;
        ctx.lineWidth = a.cls === "regular" ? 0.9 : 1.6;
        ctx.beginPath();
        let started = false;
        let hx = 0, hy = 0, hv = false;
        const steps = 28;
        for (let s = 0; s <= steps * head; s++) {
          const u = s / steps;
          const [x, y, d] = proj(slerp(a.a, a.b, u), 1 + 0.18 * Math.sin(Math.PI * u));
          if (d < -0.05) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else ctx.lineTo(x, y);
          hx = x;
          hy = y;
          hv = true;
        }
        ctx.stroke();
        if (hv) {
          ctx.fillStyle = `rgba(${rgb},${fade})`;
          const hs = a.cls === "regular" ? 3 : 5;
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
          if (labels && a.label && k > 0.6) {
            ctx.font = "11px ui-monospace, SFMono-Regular, monospace";
            ctx.fillText(a.label, hx + 6, hy - 6);
          }
        }
      }

      if (labels && f && fk > 0) {
        ctx.font = "600 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(${P.accent},${fk})`;
        ctx.fillText(f.label, cx, cy - R - 18);
        ctx.textAlign = "left";
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    }
    draw();
    const onResize = () => reduced && draw();
    window.addEventListener("resize", onResize);
    // Reduced motion: no animation loop, but repaint once a second so late data and theme changes still show.
    const still = reduced ? setInterval(draw, 1000) : undefined;
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      clearInterval(still);
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
    };
  }, [labels]);

  return <canvas ref={canvas} className="gw-globe-canvas" role="img" aria-label="Globe of reachable Bitcoin nodes with live relay activity. Drag to rotate." />;
}
