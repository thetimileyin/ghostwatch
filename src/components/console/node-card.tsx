"use client";

import type { NodePlace } from "@/lib/pulse/types";

export interface PlaceHit {
  x: number;
  y: number;
  r: number;
  place: NodePlace;
}

/** Nearest place to a point, within its hit radius. Hits are the last frame's screen positions. */
export function hitPlace(
  hits: PlaceHit[],
  x: number,
  y: number,
): PlaceHit | null {
  let best: PlaceHit | null = null;
  let bestD = Infinity;
  for (const h of hits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d <= h.r && d < bestD) {
      best = h;
      bestD = d;
    }
  }
  return best;
}

/** Hit radius grows gently with the number of nodes in a place. */
export const placeRadius = (count: number) =>
  6 + Math.min(10, Math.sqrt(count));

const pct = (f: number) =>
  f >= 0.1
    ? `${Math.round(f * 100)}%`
    : f >= 0.001
      ? `${(f * 100).toFixed(1)}%`
      : "<0.1%";

/**
 * What a place on the map is: how many nodes, which software, how many are caught up.
 * Counts only; no addresses or providers are ever sent to the browser.
 */
export function NodeCard({
  hit,
  w,
  h,
}: {
  hit: PlaceHit;
  w: number;
  h: number;
}) {
  const { place } = hit;
  const ch = place.versions?.length ? 170 : 72;
  const left = Math.min(Math.max(8, hit.x + 14), Math.max(8, w - 228));
  const top = hit.y + 14 + ch > h ? Math.max(8, hit.y - 14 - ch) : hit.y + 14;
  return (
    <div className="nc" style={{ left, top }} role="status" aria-live="polite">
      <div className="nc-h">
        <b>{place.name}</b>
        <span className="num">
          {place.count.toLocaleString("en-US")} node
          {place.count === 1 ? "" : "s"}
        </span>
      </div>
      {place.versions?.length ? (
        <ul className="nc-v">
          {place.versions.map((v) => (
            <li key={v.label}>
              <span className="nc-l">{v.label}</span>
              <span className="nc-bar" aria-hidden="true">
                <i style={{ width: `${Math.round(v.share * 100)}%` }} />
              </span>
              <span className="nc-p num">{Math.round(v.share * 100)}%</span>
            </li>
          ))}
        </ul>
      ) : null}
      {place.synced != null ? (
        <div className="nc-f">
          <span className="num">{Math.round(place.synced * 100)}%</span> at the
          latest block
        </div>
      ) : place.share != null ? (
        <div className="nc-f">
          <span className="num">{pct(place.share)}</span> of the nodes on the
          map
        </div>
      ) : null}
    </div>
  );
}
