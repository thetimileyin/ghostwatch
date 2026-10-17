import type { Cohort } from "./types";

// Feed filters live in the URL (?age=10&min=1) so a filtered view is shareable.

export const AGE_OPTIONS: { value: Cohort; label: string }[] = [
  { value: 5, label: "All 5Y+" },
  { value: 10, label: "10Y+" },
  { value: 15, label: "15Y+" },
];
export const MIN_OPTIONS = [
  { value: 0, label: "Any size" },
  { value: 1, label: "≥ 1 BTC" },
  { value: 100, label: "≥ 100 BTC" },
];

export interface FeedQuery {
  age: Cohort;
  min: number; // BTC
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function get(p: Params, k: string): string | undefined {
  if (p instanceof URLSearchParams) return p.get(k) ?? undefined;
  const v = p[k];
  return Array.isArray(v) ? v[0] : v;
}

export function parseFeedQuery(p: Params): FeedQuery {
  const age = Number(get(p, "age"));
  const min = Number(get(p, "min"));
  return {
    age: age === 10 || age === 15 ? age : 5,
    min: MIN_OPTIONS.some((o) => o.value === min) ? min : 0,
  };
}

export function feedQueryString(q: FeedQuery): string {
  const sp = new URLSearchParams();
  if (q.age !== 5) sp.set("age", String(q.age));
  if (q.min !== 0) sp.set("min", String(q.min));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const toFilter = (q: FeedQuery) => ({ minCohort: q.age, minSats: Math.round(q.min * 1e8) });
