"use client";

import { useEffect, useRef } from "react";
import { LAND_PATH } from "@/lib/geo/land";
import { classifyTx, type TxClass } from "@/lib/pulse/interest";
import { btc } from "@/lib/pulse/format";
import type { NodesSnapshot, PulseBlock, PulseTx } from "@/lib/pulse/types";
import { palette, type Palette } from "@/lib/theme/theme";

const LAT_TOP = 80;
const LAT_BOTTOM = -58;
const SPAN_Y = LAT_TOP - LAT_BOTTOM;

const arcRgb = (p: Palette, c: TxClass) => (c === "rush" ? p.accent : c === "whale" ? p.fg : c === "large" ? p.fg2 : p.fg3);

// Land as a pixel grid: one square per CELL degrees, sampled from the coastline once.
const CELL = 1.25;
let landCells: [number, number][] | null = null;
function cells(): [number, number][] {
  if (landCells) return landCells;
  const ctx = document.createElement("canvas").getContext("2d")!;
  const path = new Path2D(LAND_PATH);
  const out: [number, number][] = [];
  for (let lat = LAT_TOP - CELL / 2; lat > LAT_BOTTOM; lat -= CELL) {
    for (let lng = -180 + CELL / 2; lng < 180; lng += CELL) {
      if (ctx.isPointInPath(path, lng + 180, 90 - lat)) out.push([lat, lng]);
    }
  }
  landCells = out;
  return out;
}

interface Arc { a: [number, number]; b: [number, number]; start: number; dur: number; cls: TxClass; label: string | null }

/**
 * Real reachable-node locations on a world outline. Arcs illustrate transactions
 * relaying across the network: endpoints are random nodes, not real senders.
 * A new block lights up every node at once, since every node receives it.
 */
export function NetMap({
  nodes,
  newTxs,
  newBlock,
  fastestFee,
}: {
  nodes: NodesSnapshot | null;
  newTxs: { batch: number; txs: PulseTx[] };
  newBlock: { batch: number; block: PulseBlock | null };
  fastestFee: number | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const arcs = useRef<Arc[]>([]);
  const flash = useRef<{ at: number; label: string } | null>(null);
  const nodesRef = useRef(nodes);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    const pts = nodesRef.current?.points;
    if (!pts?.length || !newTxs.txs.length) return;
    const now = performance.now();
    const txs = newTxs.batch === 1 ? newTxs.txs.slice(0, 24) : newTxs.txs;
    const spread = 3800 / Math.max(1, txs.length);
    txs.forEach((t, i) => {
      const a = pts[Math.floor(Math.random() * pts.length)];
      let b = pts[Math.floor(Math.random() * pts.length)];
      for (let k = 0; k < 6 && Math.abs(a[1] - b[1]) + Math.abs(a[0] - b[0]) < 25; k++) b = pts[Math.floor(Math.random() * pts.length)];
      const cls = classifyTx(t, fastestFee);
      arcs.current.push({ a, b, start: now + i * spread, dur: cls === "regular" ? 1500 : 2600, cls, label: cls === "regular" ? null : btc(t.value) });
    });
    if (arcs.current.length > 140) arcs.current.splice(0, arcs.current.length - 140);
  }, [newTxs, fastestFee]);

  useEffect(() => {
    if (newBlock.block) flash.current = { at: performance.now(), label: `BLOCK ${newBlock.block.height.toLocaleString("en-US")}${newBlock.block.pool ? ` · ${newBlock.block.pool.toUpperCase()}` : ""}` };
  }, [newBlock]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const land = cells();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const t = performance.now();

      // Fit the cropped equirectangular world into the canvas.
      const mw = Math.min(W * 0.98, (H * 0.94 * 360) / SPAN_Y);
      const mh = (mw * SPAN_Y) / 360;
      const ox = (W - mw) / 2, oy = (H - mh) / 2;
      const proj = (lat: number, lng: number): [number, number] => [ox + ((lng + 180) / 360) * mw, oy + ((LAT_TOP - lat) / SPAN_Y) * mh];

      const P = palette();
      // Graticule
      ctx.strokeStyle = `rgba(${P.fg},${P.dark ? 0.06 : 0.09})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let lng = -180; lng <= 180; lng += 30) {
        const [x] = proj(0, lng);
        ctx.moveTo(x, oy);
        ctx.lineTo(x, oy + mh);
      }
      for (let lat = -30; lat <= 60; lat += 30) {
        const [, y] = proj(lat, 0);
        ctx.moveTo(ox, y);
        ctx.lineTo(ox + mw, y);
      }
      ctx.stroke();

      // Land: square pixels
      const cell = (CELL / 360) * mw;
      const sq = Math.max(1, cell * 0.62);
      // Light mode needs darker land: pale pixels on an off-white sheet washed out.
      ctx.fillStyle = `rgba(${P.fg},${P.dark ? 0.16 : 0.26})`;
      for (const [lat, lng] of land) {
        const [x, y] = proj(lat, lng);
        ctx.fillRect(x - sq / 2, y - sq / 2, sq, sq);
      }

      // Nodes
      const f = flash.current;
      const fk = f ? Math.max(0, 1 - (t - f.at) / 1800) : 0;
      if (f && fk === 0) flash.current = null;
      const pts = nodesRef.current?.points ?? [];
      if (fk > 0) {
        ctx.fillStyle = `rgba(${P.accent},${0.3 * fk})`;
        const g = 3 + 6 * fk;
        for (const [lat, lng] of pts) {
          if (lat < LAT_BOTTOM || lat > LAT_TOP) continue;
          const [x, y] = proj(lat, lng);
          ctx.fillRect(x - g / 2, y - g / 2, g, g);
        }
      }
      if (P.dark) {
        ctx.fillStyle = `rgba(${P.fg},0.028)`;
        for (const [lat, lng] of pts) {
          if (lat < LAT_BOTTOM || lat > LAT_TOP) continue;
          const [x, y] = proj(lat, lng);
          ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
        }
      }
      ctx.fillStyle = `rgba(${P.fg},0.78)`;
      for (const [lat, lng] of pts) {
        if (lat < LAT_BOTTOM || lat > LAT_TOP) continue;
        const [x, y] = proj(lat, lng);
        ctx.fillRect(x - 1.1, y - 1.1, 2.2, 2.2);
      }

      // Relay arcs
      const list = arcs.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        const k = (t - r.start) / r.dur;
        if (k < 0) continue;
        if (k > 1.6) {
          list.splice(i, 1);
          continue;
        }
        const [x1, y1] = proj(r.a[0], r.a[1]);
        const [x2, y2] = proj(r.b[0], r.b[1]);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.28;
        const head = Math.min(1, k);
        const fade = k > 1 ? 1 - (k - 1) / 0.6 : 1;
        const rgb = arcRgb(P, r.cls);
        ctx.strokeStyle = `rgba(${rgb},${(r.cls === "regular" ? (P.dark ? 0.32 : 0.55) : 0.85) * fade})`;
        ctx.lineWidth = r.cls === "regular" ? (P.dark ? 0.8 : 1) : 1.5;
        ctx.beginPath();
        const steps = 24;
        for (let s = 0; s <= steps * head; s++) {
          const u = s / steps;
          const x = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2;
          const y = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        const hx = (1 - head) * (1 - head) * x1 + 2 * (1 - head) * head * mx + head * head * x2;
        const hy = (1 - head) * (1 - head) * y1 + 2 * (1 - head) * head * my + head * head * y2;
        ctx.fillStyle = `rgba(${rgb},${fade})`;
        const hs = r.cls === "regular" ? 3 : 5;
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        if (r.label && k > 0.6) {
          ctx.font = "11px ui-monospace, SFMono-Regular, monospace";
          ctx.fillStyle = `rgba(${rgb},${fade})`;
          ctx.fillText(r.label, x2 + 6, y2 - 6);
        }
      }

      if (f && fk > 0) {
        ctx.font = "600 12px ui-monospace, SFMono-Regular, monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(${P.accent},${fk})`;
        ctx.fillText(f.label, W / 2, 26);
        ctx.textAlign = "left";
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => reduced && draw();
    window.addEventListener("resize", onResize);
    // Reduced motion: no animation loop, but repaint once a second so late data and theme changes still show.
    const still = reduced ? setInterval(draw, 1000) : undefined;
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      clearInterval(still);
    };
  }, []);

  return <canvas ref={canvas} className="gw-map-canvas" aria-label="Map of reachable Bitcoin nodes with live relay activity" role="img" />;
}
