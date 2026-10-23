"use client";

import type { RefObject } from "react";
import { ResetViewIcon, ZoomInIcon, ZoomOutIcon } from "../icons";

export interface ZoomApi {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

/**
 * Wheel, double-click, drag and pinch on a canvas, reported as zoom (factor around a
 * point) and pan (pixels). Drag only pans when `canPan()` says so, so an unzoomed map
 * on a phone still lets the page scroll.
 */
export function attachZoom(
  c: HTMLCanvasElement,
  h: { zoom: (factor: number, x: number, y: number) => void; pan: (dx: number, dy: number) => void; canPan: () => boolean; end?: () => void },
) {
  const pts = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const local = (e: { clientX: number; clientY: number }) => {
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const wheel = (e: WheelEvent) => {
    // When the page itself scrolls (tablets, small laptops), a plain wheel keeps scrolling the
    // page; zoom needs a pinch (sent as ctrl+wheel) or Ctrl/Cmd + scroll. Full-screen terminal: wheel zooms.
    const pageScrolls = document.documentElement.scrollHeight > window.innerHeight + 4;
    if (pageScrolls && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const { x, y } = local(e);
    // Trackpad pinch arrives as ctrl+wheel with small deltas; plain wheels are coarser.
    h.zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018)), x, y);
  };
  const dbl = (e: MouseEvent) => {
    const { x, y } = local(e);
    h.zoom(e.shiftKey ? 0.5 : 2, x, y);
  };
  const down = (e: PointerEvent) => {
    pts.set(e.pointerId, local(e));
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
    if (pts.size === 1 && !h.canPan()) return;
    c.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pts.set(e.pointerId, p);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) h.zoom(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = d;
    } else if (pts.size === 1 && h.canPan()) {
      h.pan(p.x - prev.x, p.y - prev.y);
    }
  };
  const up = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    pinch = 0;
    if (pts.size === 0) h.end?.();
  };
  c.addEventListener("wheel", wheel, { passive: false });
  c.addEventListener("dblclick", dbl);
  c.addEventListener("pointerdown", down);
  c.addEventListener("pointermove", move);
  c.addEventListener("pointerup", up);
  c.addEventListener("pointercancel", up);
  return () => {
    c.removeEventListener("wheel", wheel);
    c.removeEventListener("dblclick", dbl);
    c.removeEventListener("pointerdown", down);
    c.removeEventListener("pointermove", move);
    c.removeEventListener("pointerup", up);
    c.removeEventListener("pointercancel", up);
  };
}

/** + / − / reset, for people without a wheel or trackpad. */
export function ZoomControls({ api }: { api: RefObject<ZoomApi | null> }) {
  return (
    <div className="zm" role="group" aria-label="Zoom">
      <button type="button" onClick={() => api.current?.zoomIn()} aria-label="Zoom in" title="Zoom in (or scroll)"><ZoomInIcon aria-hidden /></button>
      <button type="button" onClick={() => api.current?.zoomOut()} aria-label="Zoom out" title="Zoom out"><ZoomOutIcon aria-hidden /></button>
      <button type="button" onClick={() => api.current?.reset()} aria-label="Reset view" title="Reset view"><ResetViewIcon aria-hidden /></button>
    </div>
  );
}
