import { calendarSpan } from "./time";

const SATS = 100_000_000;

/** "1234.56781234" with all 8 decimals; integer math avoids float drift. */
export function satsToBtcString(sats: number): string {
  const sign = sats < 0 ? "-" : "";
  const abs = Math.abs(sats);
  const whole = Math.floor(abs / SATS);
  const frac = String(abs % SATS).padStart(8, "0");
  return `${sign}${whole.toLocaleString("en-US")}.${frac}`;
}

/**
 * Splits an amount for display: the significant head stays bright, trailing
 * decimals are dimmed but always shown. 0.70084841 -> ["0.70", "084841"].
 */
export function splitBtc(sats: number, brightDecimals = 2): { head: string; tail: string } {
  const s = satsToBtcString(sats);
  const dot = s.indexOf(".");
  return { head: s.slice(0, dot + 1 + brightDecimals), tail: s.slice(dot + 1 + brightDecimals) };
}

/** Compact amount for headlines and share text: 10,000.01 BTC, 0.7008 BTC, 0.00012 BTC. */
export function btcShort(sats: number): string {
  const btc = sats / SATS;
  if (btc >= 100) return `${btc.toLocaleString("en-US", { maximumFractionDigits: 2 })} BTC`;
  if (btc >= 1) return `${btc.toLocaleString("en-US", { maximumFractionDigits: 4 })} BTC`;
  return `${btc.toLocaleString("en-US", { maximumSignificantDigits: 4 })} BTC`;
}

export function satsLabel(sats: number): string {
  return `${sats.toLocaleString("en-US")} sats`;
}

/** "6y 8m 22d" (compact) */
export function durationShort(fromUnix: number, toUnix: number): string {
  const s = calendarSpan(fromUnix, toUnix);
  return `${s.years}y ${s.months}m ${s.days}d`;
}

/** "6 years and 8 months" (prose; days dropped once years are involved). */
export function durationLong(fromUnix: number, toUnix: number): string {
  const s = calendarSpan(fromUnix, toUnix);
  const y = s.years === 1 ? "1 year" : `${s.years} years`;
  if (s.months === 0) return y;
  const m = s.months === 1 ? "1 month" : `${s.months} months`;
  return `${y} and ${m}`;
}

const monthYearFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

export const monthYear = (unix: number) => monthYearFmt.format(unix * 1000);
export const dateShort = (unix: number) => dateFmt.format(unix * 1000);
export const dateTimeUtc = (unix: number) => `${dateTimeFmt.format(unix * 1000)} UTC`;
export const isoDate = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);

export const heightLabel = (h: number) => h.toLocaleString("en-US");

export function middleTruncate(s: string, keep = 8): string {
  return s.length <= keep * 2 + 1 ? s : `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

/** "3 min ago", "2 h ago", "just now" */
export function ago(seconds: number): string {
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86_400)} d ago`;
}
