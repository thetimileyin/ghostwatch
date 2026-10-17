export const usd = (n: number | null, digits = 0) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });

/** 0.00123 BTC, 12.4 BTC, 1,204 BTC */
export function btc(sats: number): string {
  const v = sats / 1e8;
  if (v >= 1000) return `${Math.round(v).toLocaleString("en-US")} BTC`;
  if (v >= 1) return `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })} BTC`;
  return `${v.toLocaleString("en-US", { maximumSignificantDigits: 3 })} BTC`;
}

export const compact = (n: number) => n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function sinceShort(fromSec: number, nowMs: number): string {
  const s = Math.max(0, Math.round(nowMs / 1000 - fromSec));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const vmb = (vsize: number) => `${(vsize / 1e6).toFixed(1)} vMB`;
export const satvb = (r: number) => `${r < 10 ? r.toFixed(1) : Math.round(r)} sat/vB`;
export const short = (h: string, n = 6) => `${h.slice(0, n)}…${h.slice(-n)}`;
