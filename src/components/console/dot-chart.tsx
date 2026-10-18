"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Dot-matrix area chart: a crisp line on top, the area beneath drawn as a grid of
 * square dots that thin out toward the baseline. The latest column is the one
 * orange mark. Values are bucketed into fixed columns so the grain stays even.
 * Hover (or arrow keys when focused) reads out the exact point under the cursor.
 */
export function DotChart({
  values,
  labels,
  cols = 48,
  rows = 12,
  label,
  axis,
  format = (n) => n.toFixed(1),
}: {
  values: number[];
  /** One label per value (for example "Block 972,031 · 3h ago"), shown on hover. */
  labels?: string[];
  cols?: number;
  rows?: number;
  label: string;
  axis: [string, string];
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = cols * 6;
  const H = rows * 6;
  if (values.length < 2) {
    return (
      <div className="dc dc--empty" role="img" aria-label={`${label}: loading`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" />
      </div>
    );
  }
  // Bucket into columns, keeping the highest value in each (fees spike, they don't average),
  // and remember which source point that was so hover can name it.
  const buckets = Array.from({ length: cols }, (_, i) => {
    const a = Math.floor((i * values.length) / cols);
    const b = Math.max(a + 1, Math.floor(((i + 1) * values.length) / cols));
    let at = a;
    for (let k = a; k < b && k < values.length; k++) if (values[k] > values[at]) at = k;
    return { v: values[at], at };
  });
  const max = Math.max(...buckets.map((b) => b.v)) || 1;
  const heights = buckets.map((b) => (b.v / max) * rows);
  const dots: { x: number; y: number; o: number; c: number }[] = [];
  heights.forEach((h, c) => {
    for (let r = 0; r < Math.ceil(h); r++) {
      const depth = (r + 1) / Math.max(1, h); // 1 at the line, toward 0 at the base
      dots.push({ x: c * 6 + 3, y: H - r * 6 - 3, o: 0.22 + 0.78 * depth ** 1.2, c });
    }
  });
  const line = heights.map((h, c) => `${c * 6 + 3},${(H - h * 6).toFixed(1)}`).join(" ");
  const last = buckets[cols - 1].v;
  const shown = hover ?? cols - 1;
  const point = buckets[shown];

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * cols);
    setHover(Math.max(0, Math.min(cols - 1, c)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? cols - 1) - 1));
    else if (e.key === "ArrowRight") setHover((h) => Math.min(cols - 1, (h ?? cols - 1) + 1));
    else return;
    e.preventDefault();
  };

  return (
    <figure className="dc" aria-label={`${label}. Highest ${format(max)}, latest ${format(last)}.`}>
      <div className="dc-read" aria-live="polite">
        <b className="num">{format(point.v)}</b>
        <span>{labels?.[point.at] ?? (hover == null ? "latest" : "")}</span>
      </div>
      <div className="dc-plot">
        <span className="dc-y dc-y--top num">{format(max)}</span>
        <span className="dc-y dc-y--bot num">0</span>
        <div
          className="dc-hit"
          tabIndex={0}
          role="slider"
          aria-label={`${label}. Use left and right arrows to read each point.`}
          aria-valuemin={0}
          aria-valuemax={cols - 1}
          aria-valuenow={shown}
          aria-valuetext={`${format(point.v)}${labels?.[point.at] ? `, ${labels[point.at]}` : ""}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            {hover != null && <rect x={hover * 6} y={0} width={6} height={H} className="dc-col" />}
            {dots.map((d, i) => (
              <rect
                key={i}
                x={d.x - 1.4}
                y={d.y - 1.4}
                width={2.8}
                height={2.8}
                className={d.c === shown ? "dc-dot dc-dot--last" : "dc-dot"}
                style={{ opacity: hover != null && d.c !== hover ? d.o * 0.55 : d.o }}
              />
            ))}
            <polyline points={line} className="dc-line" vectorEffect="non-scaling-stroke" />
            <rect x={shown * 6 + 0.5} y={H - heights[shown] * 6 - 2.5} width={5} height={5} className="dc-head" />
          </svg>
        </div>
      </div>
      <figcaption className="dc-x">
        <span>{axis[0]}</span>
        <span>{axis[1]}</span>
      </figcaption>
    </figure>
  );
}
