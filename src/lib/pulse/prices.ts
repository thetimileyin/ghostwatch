/**
 * Bitcoin's price history, reduced to what the Price view shows: one closing price per
 * UTC day, the all-time high, and a summary for each calendar year.
 */

export interface YearStat {
  year: number;
  open: number;
  close: number;
  high: number;
  low: number;
  /** close / open - 1. For the current year this is "so far". */
  change: number;
  /** False for the year the record starts in (2010) and the year still running. */
  complete: boolean;
}

export interface PriceHistory {
  /** Days since 1970-01-01 (UTC), oldest first, matching `usd`. */
  days: number[];
  usd: number[];
  ath: { usd: number; day: number };
  first: { usd: number; day: number };
  years: YearStat[];
  updatedAt: number;
}

const DAY = 86400;

/** Keep prices readable and the payload small: whole dollars above $100, cents above $1. */
export function roundPrice(v: number): number {
  if (v >= 100) return Math.round(v);
  if (v >= 1) return Math.round(v * 100) / 100;
  return Number(v.toPrecision(3));
}

/**
 * From the source's raw series (any order, mixed hourly and weekly points, USD per BTC)
 * to one closing price per day. Zero or missing prices are dropped.
 */
export function summarizePrices(raw: { time: number; USD: number }[], now = Date.now()): PriceHistory | null {
  const pts = raw.filter((p) => p && p.USD > 0 && Number.isFinite(p.time)).sort((a, b) => a.time - b.time);
  if (pts.length < 2) return null;

  // Last price seen in each UTC day is that day's close; the day's high feeds the all-time high.
  const days: number[] = [];
  const usd: number[] = [];
  let ath = { usd: 0, day: 0 };
  // Highs and lows come from every point, not just daily closes, so they agree with the all-time high.
  const range = new Map<number, { high: number; low: number }>();
  for (const p of pts) {
    const d = Math.floor(p.time / DAY);
    if (p.USD > ath.usd) ath = { usd: p.USD, day: d };
    const y = new Date(p.time * 1000).getUTCFullYear();
    const r = range.get(y);
    if (r) {
      r.high = Math.max(r.high, p.USD);
      r.low = Math.min(r.low, p.USD);
    } else range.set(y, { high: p.USD, low: p.USD });
    if (days.length && days[days.length - 1] === d) usd[usd.length - 1] = p.USD;
    else {
      days.push(d);
      usd.push(p.USD);
    }
  }

  const thisYear = new Date(now).getUTCFullYear();
  const byYear = new Map<number, number[]>();
  days.forEach((d, i) => {
    const y = new Date(d * DAY * 1000).getUTCFullYear();
    const list = byYear.get(y) ?? [];
    list.push(usd[i]);
    byYear.set(y, list);
  });
  const firstYear = new Date(days[0] * DAY * 1000).getUTCFullYear();
  // A year opens at the previous year's close (early data is weekly, so the first point of a
  // year can be mid-January); the year the record starts in opens at its first price.
  let prevClose: number | null = null;
  const years: YearStat[] = [...byYear.entries()].map(([year, v]) => {
    const open = prevClose ?? v[0];
    const close = v[v.length - 1];
    prevClose = close;
    const r = range.get(year)!;
    return {
      year,
      open: roundPrice(open),
      close: roundPrice(close),
      high: roundPrice(Math.max(r.high, open)),
      low: roundPrice(Math.min(r.low, open)),
      change: close / open - 1,
      complete: year !== firstYear && year !== thisYear,
    };
  });

  return {
    days,
    usd: usd.map(roundPrice),
    ath: { usd: roundPrice(ath.usd), day: ath.day },
    first: { usd: roundPrice(usd[0]), day: days[0] },
    years,
    updatedAt: now,
  };
}

/** Bitcoin's halvings so far: the block subsidy is cut in half every 210,000 blocks. */
export const HALVINGS: { height: number; day: number; reward: string }[] = [
  { height: 210_000, day: Math.floor(Date.UTC(2012, 10, 28) / 1000 / DAY), reward: "25 BTC" },
  { height: 420_000, day: Math.floor(Date.UTC(2016, 6, 9) / 1000 / DAY), reward: "12.5 BTC" },
  { height: 630_000, day: Math.floor(Date.UTC(2020, 4, 11) / 1000 / DAY), reward: "6.25 BTC" },
  { height: 840_000, day: Math.floor(Date.UTC(2024, 3, 20) / 1000 / DAY), reward: "3.125 BTC" },
];

/** Closing price on the day of `unix` (seconds), or null before the record starts (July 2010). */
export function priceOnDay(h: PriceHistory | null, unix: number): number | null {
  if (!h || h.days.length === 0) return null;
  const day = Math.floor(unix / DAY);
  if (day < h.days[0]) return null;
  let lo = 0, hi = h.days.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (h.days[mid] <= day) lo = mid;
    else hi = mid - 1;
  }
  return h.usd[lo];
}
