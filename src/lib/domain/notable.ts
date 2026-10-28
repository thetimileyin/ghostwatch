import { yearsToSeconds } from "./time";

/**
 * "Notable" awakenings: unspent 10+ years AND 1+ BTC. About a dozen a day, against several
 * hundred five-year-old coins, so these are the ones shown first and posted to Telegram.
 */
export const NOTABLE_MIN_YEARS = 10;
export const NOTABLE_MIN_SATS = 100_000_000;
export const NOTABLE_MIN_AGE = yearsToSeconds(NOTABLE_MIN_YEARS);

export const isNotable = (e: { dormantSats: number; maxAgeSeconds: number }) => e.dormantSats >= NOTABLE_MIN_SATS && e.maxAgeSeconds >= NOTABLE_MIN_AGE;

/**
 * "Most notable" first: the longest asleep, then the largest. Age is the story (coins from
 * 2011 are far rarer than ones from 2016); the 1 BTC floor already makes every one sizeable.
 */
export const compareNotable = (a: { dormantSats: number; maxAgeSeconds: number }, b: { dormantSats: number; maxAgeSeconds: number }) =>
  b.maxAgeSeconds - a.maxAgeSeconds || b.dormantSats - a.dormantSats;
