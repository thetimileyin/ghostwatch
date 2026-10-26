"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { HALVINGS, type PriceHistory } from "@/lib/pulse/prices";
import { useView } from "./view";

// Terminal "Price" view: Bitcoin's price since July 2010, its all-time high, and each year.
const DAY_MS = 86400_000;
const STEP = 6; // dot grid pitch, same grain as the fee chart

type Range = "1y" | "5y" | "all";
const RANGES: { k: Range; label: string; days: number | null; span: string }[] = [
  { k: "1y", label: "1Y", days: 365, span: "Over 1 year" },
  { k: "5y", label: "5Y", days: 5 * 365, span: "Over 5 years" },
  { k: "all", label: "All", days: null, span: "Since 2010" },
];

export function fmtPrice(v: number): string {
  if (v >= 100) return `$${Math.round(v).toLocaleString("en-US")}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toPrecision(2)}`;
}

const fmtDate = (day: number, withDay = true) =>
  new Date(day * DAY_MS).toLocaleDateString("en-GB", { day: withDay ? "numeric" : undefined, month: "short", year: "numeric", timeZone: "UTC" });

/** Percent change; past +10,000% (100x) a multiple reads better: "934,171×". */
const pct = (f: number) =>
  f >= 100
    ? `${Math.round(1 + f).toLocaleString("en-US")}×`
    : `${f >= 0 ? "+" : "−"}${Math.abs(f * 100) >= 100 ? Math.round(Math.abs(f * 100)).toLocaleString("en-US") : Math.abs(f * 100).toFixed(1)}%`;

/** Size of an element that may mount later (the chart only renders once data arrives). */
function useSize<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size] as const;
}

/** Price gridlines: powers of ten on a log scale, round steps on a linear one. */
function ticks(min: number, max: number, log: boolean): number[] {
  if (log) {
    const out: number[] = [];
    for (let e = Math.ceil(Math.log10(min)); e <= Math.floor(Math.log10(max)); e++) out.push(10 ** e);
    return out;
  }
  const raw = (max - min) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v);
  return out;
}

const tickLabel = (v: number) => (v >= 1000 ? `$${(v / 1000).toLocaleString("en-US")}K` : v >= 1 ? `$${v}` : `$${v}`);

export function PriceTrends({ live }: { live: number | null }) {
  const view = useView();
  const [hist, setHist] = useState<PriceHistory | null>(null);
  const [failed, setFailed] = useState(false);
  const [range, setRange] = useState<Range>("all");
  const [hover, setHover] = useState<number | null>(null);
  const [plotRef, { w: W, h: H }] = useSize<HTMLDivElement>();
  const yearsRef = useRef<HTMLOListElement>(null);
  // Start the year strip at the latest years when it doesn't fit.
  useEffect(() => {
    const el = yearsRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [hist]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      fetch("/api/price-history")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: PriceHistory | null) => {
          if (!alive) return;
          if (d?.days?.length) {
            setHist(d);
            setFailed(false);
          } else {
            setFailed(true);
            timer = setTimeout(load, 60_000);
          }
        })
        .catch(() => {
          if (!alive) return;
          setFailed(true);
          timer = setTimeout(load, 60_000);
        });
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // Series with today's live price as the last point; the live price can set a new high.
  const series = useMemo(() => {
    if (!hist) return null;
    const days = [...hist.days];
    const usd = [...hist.usd];
    const today = Math.floor(Date.now() / DAY_MS);
    if (live) {
      if (days[days.length - 1] === today) usd[usd.length - 1] = live;
      else {
        days.push(today);
        usd.push(live);
      }
    }
    const ath = live && live > hist.ath.usd ? { usd: live, day: today } : hist.ath;
    return { days, usd, ath };
  }, [hist, live]);

  const r = RANGES.find((x) => x.k === range)!;
  const log = range === "all";

  const view_ = useMemo(() => {
    if (!series) return null;
    const last = series.days[series.days.length - 1];
    const from = r.days ? last - r.days : series.days[0];
    let i0 = series.days.findIndex((d) => d >= from);
    if (i0 < 0) i0 = 0;
    const days = series.days.slice(i0);
    const usd = series.usd.slice(i0);
    const lo = Math.min(...usd);
    const hi = Math.max(...usd);
    const min = log ? lo / 1.6 : Math.max(0, lo - (hi - lo) * 0.08);
    const max = log ? hi * 1.6 : hi + (hi - lo) * 0.08;
    return { days, usd, d0: days[0], d1: last, min, max };
  }, [series, r.days, log]);

  const pad = { t: 22, b: 4 };
  const ph = Math.max(0, H - pad.t - pad.b);
  const geo = useMemo(() => {
    if (!view_ || W < 40 || ph < 40) return null;
    const { d0, d1, min, max } = view_;
    const x = (d: number) => ((d - d0) / Math.max(1, d1 - d0)) * W;
    const y = log
      ? (v: number) => pad.t + ph - ((Math.log10(v) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))) * ph
      : (v: number) => pad.t + ph - ((v - min) / (max - min)) * ph;
    return { x, y };
  }, [view_, W, ph, log, pad.t]);

  // Dot-matrix area under the line, thinning toward the baseline (memoized: hover doesn't redraw it).
  const dots = useMemo(() => {
    if (!view_ || !geo) return [];
    const out: { x: number; y: number; o: number }[] = [];
    const cols = Math.floor(W / STEP);
    let k = 0;
    for (let c = 0; c < cols; c++) {
      const cx = c * STEP + STEP / 2;
      while (k < view_.days.length - 1 && geo.x(view_.days[k + 1]) <= cx) k++;
      const top = geo.y(view_.usd[k]);
      const h = pad.t + ph - top;
      for (let rr = 0; rr * STEP < h; rr++) {
        const depth = (rr + 1) / Math.max(1, h / STEP);
        out.push({ x: cx, y: pad.t + ph - rr * STEP - STEP / 2, o: 0.12 + 0.6 * depth ** 1.4 });
      }
    }
    return out;
  }, [view_, geo, W, ph, pad.t]);

  if (!series || !view_) {
    return (
      <div className="pt pt--empty" role="status">
        {failed ? "Price history is unavailable right now. Retrying every minute." : "Loading 16 years of prices…"}
      </div>
    );
  }

  const n = view_.days.length;
  const shown = hover ?? n - 1;
  const now = series.usd[series.usd.length - 1];
  const fromHigh = now / series.ath.usd - 1;
  const spanChange = now / view_.usd[0] - 1;
  const line = geo ? view_.days.map((d, i) => `${geo.x(d).toFixed(1)},${geo.y(view_.usd[i]).toFixed(1)}`).join(" ") : "";
  const yt = ticks(view_.min, view_.max, log);
  const athIn = series.ath.day >= view_.d0;
  const halvings = HALVINGS.filter((hv) => hv.day >= view_.d0 && hv.day <= view_.d1);

  // X labels: years for long ranges, months for one year.
  const xt: { d: number; label: string }[] = [];
  if (range === "1y") {
    for (let m = 0; m < 13; m += 2) {
      const dt = new Date(view_.d0 * DAY_MS);
      const t = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + m + 1, 1) / DAY_MS;
      if (t <= view_.d1) xt.push({ d: t, label: new Date(t * DAY_MS).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) });
    }
  } else {
    const y0 = new Date(view_.d0 * DAY_MS).getUTCFullYear() + 1;
    const y1 = new Date(view_.d1 * DAY_MS).getUTCFullYear();
    const every = range === "all" ? (W < 520 ? 4 : 2) : 1;
    for (let y = y0; y <= y1; y++) if ((y - y0) % every === 0) xt.push({ d: Date.UTC(y, 0, 1) / DAY_MS, label: String(y) });
  }

  const pick = (clientX: number, el: HTMLElement) => {
    if (!geo) return;
    const rect = el.getBoundingClientRect();
    const d = view_.d0 + ((clientX - rect.left) / rect.width) * (view_.d1 - view_.d0);
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (view_.days[mid] < d) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && d - view_.days[lo - 1] < view_.days[lo] - d) lo--;
    setHover(lo);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const jump = e.shiftKey ? 30 : 1;
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - jump));
    else if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? n - 1) + jump));
    else return;
    e.preventDefault();
  };

  const pv = view_.usd[shown];
  const years = hist!.years;
  const halvingYears = new Set(HALVINGS.map((hv) => new Date(hv.day * DAY_MS).getUTCFullYear()));

  return (
    <div className="pt">
      {/* One row: the headline price doubles as the hover readout; the high and the range sit beside it. */}
      <div className="pt-head">
        <div className="pt-now" aria-live="polite">
          <div className="pt-k">{hover == null ? "Bitcoin now" : fmtDate(view_.days[shown])}</div>
          <div className="pt-big num">{fmtPrice(pv)}</div>
          <div className="pt-chg">
            {hover == null ? (
              <>
                <b className={spanChange < 0 ? "pt-down" : ""}>{pct(spanChange)}</b> {r.span.toLowerCase()} · from {fmtPrice(view_.usd[0])}
              </>
            ) : hover < n - 1 ? (
              <>
                Now <b className={now < pv ? "pt-down" : ""}>{pct(now / pv - 1)}</b> since this day
              </>
            ) : (
              "Today"
            )}
          </div>
        </div>
        <div className="pt-side">
          <div className="pt-ath-r">
            <div className="pt-k">All-time high</div>
            <div className="pt-mid num">{fmtPrice(series.ath.usd)}</div>
            <div className="pt-chg">
              {fmtDate(series.ath.day)} · {fromHigh >= -0.0005 ? <b>new high</b> : <><b className="pt-down">{pct(fromHigh)}</b> now</>}
            </div>
          </div>
          <div className="seg" role="radiogroup" aria-label="Time range">
            {RANGES.map((x) => (
              <button key={x.k} type="button" role="radio" aria-checked={range === x.k} onClick={() => { setRange(x.k); setHover(null); }}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-plot" ref={plotRef}>
        <div
          className="pt-hit"
          tabIndex={0}
          role="slider"
          aria-label="Bitcoin price history. Use left and right arrows to read each day; hold Shift to move a month."
          aria-valuemin={0}
          aria-valuemax={n - 1}
          aria-valuenow={shown}
          aria-valuetext={`${fmtPrice(pv)} on ${fmtDate(view_.days[shown])}`}
          onPointerMove={(e: PointerEvent<HTMLDivElement>) => pick(e.clientX, e.currentTarget)}
          onPointerDown={(e: PointerEvent<HTMLDivElement>) => pick(e.clientX, e.currentTarget)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
        >
          {geo && (
            <svg width={W} height={H} aria-hidden="true">
              {log && <text x={4} y={12} className="pt-ylab">{view === "simple" ? "Each line is 10× the one below" : "Log scale"}</text>}
              {yt.filter((v) => !athIn || Math.abs(geo.y(v) - Math.max(12, geo.y(series.ath.usd) - 8)) > 14 || geo.x(series.ath.day) < W - 200).map((v) => (
                <g key={v}>
                  <line x1={0} x2={W} y1={geo.y(v)} y2={geo.y(v)} className="pt-grid" />
                  <text x={W - 4} y={geo.y(v) - 4} className="pt-ylab" textAnchor="end">{tickLabel(v)}</text>
                </g>
              ))}
              {halvings.map((hv) => (
                <g key={hv.height}>
                  <line x1={geo.x(hv.day)} x2={geo.x(hv.day)} y1={pad.t - 6} y2={pad.t + ph} className="pt-halving" />
                  <text x={geo.x(hv.day) + 4} y={pad.t + ph - 6} className="pt-hlab">{view === "simple" ? "Halving" : `Halving · ${hv.reward}`}</text>
                </g>
              ))}
              {dots.map((d, i) => (
                <rect key={i} x={d.x - 1.3} y={d.y - 1.3} width={2.6} height={2.6} className="pt-dot" style={{ opacity: d.o }} />
              ))}
              <polyline points={line} className="pt-line" />
              {athIn && (
                <g>
                  <rect x={geo.x(series.ath.day) - 3} y={geo.y(series.ath.usd) - 3} width={6} height={6} className="pt-ath" />
                  <text
                    x={Math.min(geo.x(series.ath.day), W - 4)}
                    y={Math.max(12, geo.y(series.ath.usd) - 8)}
                    textAnchor={geo.x(series.ath.day) > W - 140 ? "end" : "middle"}
                    className="pt-athlab"
                  >
                    High {fmtPrice(series.ath.usd)}
                  </text>
                </g>
              )}
              {hover != null && <line x1={geo.x(view_.days[shown])} x2={geo.x(view_.days[shown])} y1={pad.t} y2={pad.t + ph} className="pt-cross" />}
              <rect x={geo.x(view_.days[shown]) - 3} y={geo.y(pv) - 3} width={6} height={6} className={hover == null ? "pt-head" : "pt-head pt-head--read"} />
            </svg>
          )}
        </div>
      </div>
      <div className="pt-x" aria-hidden="true">
        {geo && xt.map((t) => (
          <span key={t.d} style={{ left: geo.x(t.d) }}>{t.label}</span>
        ))}
      </div>

      <ol className="pt-years" ref={yearsRef} aria-label="Each year: change from the previous year's close">
        {years.map((y) => (
          <li key={y.year} className={y.change < 0 ? "pt-y pt-y--down" : "pt-y"}>
            <span className="pt-y-k">
              {y.year}
              {halvingYears.has(y.year) && <i title="Halving year" aria-label="halving year" />}
            </span>
            <b className="num">{pct(y.change)}</b>
            <span className="pt-y-s num">{y.complete ? fmtPrice(y.close) : y.year === years[years.length - 1].year ? "so far" : "from Jul"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
