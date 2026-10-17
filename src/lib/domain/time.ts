import type { Cohort } from "./types";

export const SECONDS_PER_DAY = 86_400;
/** Mean Gregorian year, so "5 years" matches calendar intuition over long spans. */
export const SECONDS_PER_YEAR = 365.2425 * SECONDS_PER_DAY;
export const GENESIS_TIME = 1231006505; // 2009-01-03 18:15:05 UTC

export function yearsToSeconds(years: number): number {
  return Math.round(years * SECONDS_PER_YEAR);
}

/** Cohort for a dormancy age, or null when it is below the 5-year threshold. */
export function cohortFor(ageSeconds: number): Cohort | null {
  if (ageSeconds >= yearsToSeconds(15)) return 15;
  if (ageSeconds >= yearsToSeconds(10)) return 10;
  if (ageSeconds >= yearsToSeconds(5)) return 5;
  return null;
}

export interface CalendarSpan {
  years: number;
  months: number;
  days: number;
  totalDays: number;
}

/** Calendar difference between two unix times (UTC), e.g. 6y 8m 22d. */
export function calendarSpan(fromUnix: number, toUnix: number): CalendarSpan {
  const a = new Date(fromUnix * 1000);
  const b = new Date(toUnix * 1000);
  let years = b.getUTCFullYear() - a.getUTCFullYear();
  let months = b.getUTCMonth() - a.getUTCMonth();
  let days = b.getUTCDate() - a.getUTCDate();
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days, totalDays: Math.floor((toUnix - fromUnix) / SECONDS_PER_DAY) };
}
