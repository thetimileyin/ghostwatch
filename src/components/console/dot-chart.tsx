/**
 * Dot-matrix area chart: a crisp line on top, the area beneath drawn as a grid of
 * square dots that thin out toward the baseline. The latest column is the one
 * orange mark. Values are bucketed into fixed columns so the grain stays even.
 */
export function DotChart({
  values,
  cols = 48,
  rows = 12,
  label,
  axis,
  format = (n) => n.toFixed(1),
}: {
  values: number[];
  cols?: number;
  rows?: number;
  label: string;
  axis: [string, string];
  format?: (n: number) => string;
}) {
  const W = cols * 6;
  const H = rows * 6;
  if (values.length < 2) {
    return (
      <div className="dc dc--empty" role="img" aria-label={`${label}: loading`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" />
      </div>
    );
  }
  // Bucket into columns, keeping the highest value in each (fees spike, they don't average).
  const buckets = Array.from({ length: cols }, (_, i) => {
    const a = Math.floor((i * values.length) / cols);
    const b = Math.max(a + 1, Math.floor(((i + 1) * values.length) / cols));
    return Math.max(...values.slice(a, b));
  });
  const max = Math.max(...buckets) || 1;
  const heights = buckets.map((v) => (v / max) * rows);
  const dots: { x: number; y: number; o: number; last: boolean }[] = [];
  heights.forEach((h, c) => {
    for (let r = 0; r < Math.ceil(h); r++) {
      const depth = (r + 1) / Math.max(1, h); // 1 at the line, toward 0 at the base
      dots.push({ x: c * 6 + 3, y: H - r * 6 - 3, o: 0.22 + 0.78 * depth ** 1.2, last: c === cols - 1 });
    }
  });
  const line = heights.map((h, c) => `${c * 6 + 3},${(H - h * 6).toFixed(1)}`).join(" ");
  const last = buckets[buckets.length - 1];
  return (
    <figure className="dc" aria-label={`${label}. Highest ${format(max)}, latest ${format(last)}.`}>
      <div className="dc-plot">
        <span className="dc-y dc-y--top num">{format(max)}</span>
        <span className="dc-y dc-y--bot num">0</span>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          {dots.map((d, i) => (
            <rect key={i} x={d.x - 1.4} y={d.y - 1.4} width={2.8} height={2.8} className={d.last ? "dc-dot dc-dot--last" : "dc-dot"} style={{ opacity: d.o }} />
          ))}
          <polyline points={line} className="dc-line" vectorEffect="non-scaling-stroke" />
          <rect x={(cols - 1) * 6 + 0.5} y={H - heights[cols - 1] * 6 - 2.5} width={5} height={5} className="dc-head" />
        </svg>
      </div>
      <figcaption className="dc-x">
        <span>{axis[0]}</span>
        <span>{axis[1]}</span>
      </figcaption>
    </figure>
  );
}
