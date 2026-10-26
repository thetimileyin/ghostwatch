import { amountWords } from "@/lib/domain/format";
import { ageBucket } from "@/lib/journey/journey";

const AGE_LABEL = {
  hours: "Under a day old",
  days: "Days old",
  months: "Months old",
  years: "1 to 5 years old",
  dormant: "5+ years old",
} as const;

const plural = (k: number, one: string) => `${k.toLocaleString("en-US")} ${one}${k === 1 ? "" : "s"}`;

/** Coins grouped by age in plain words, each group's bar showing its share of the value. 5+ years is the orange one. */
export function AgeBreakdown({ coins, at, label }: { coins: { valueSats: number; time: number | null }[]; at: number; label: string }) {
  const total = coins.reduce((s, c) => s + c.valueSats, 0) || 1;
  const groups = (["hours", "days", "months", "years", "dormant"] as const)
    .map((k) => {
      const list = coins.filter((c) => c.time != null && ageBucket(at - c.time) === k);
      return { k, count: list.length, sats: list.reduce((s, c) => s + c.valueSats, 0) };
    })
    .filter((g) => g.count > 0);
  if (groups.length === 0) return null;
  return (
    <dl className="jr-ages" aria-label={label}>
      {groups.map((g) => (
        <div key={g.k} className={g.k === "dormant" ? "jr-age jr-age--old" : "jr-age"}>
          <dt>{AGE_LABEL[g.k]}</dt>
          <dd className="jr-age-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, (g.sats / total) * 100)}%` }} /></dd>
          <dd className="num">{plural(g.count, "coin")} · {amountWords(g.sats)}</dd>
        </div>
      ))}
    </dl>
  );
}
