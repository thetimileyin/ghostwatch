import { describe, expect, it } from "vitest";
import { compareNotable, isNotable } from "./notable";
import { yearsToSeconds } from "./time";

const ev = (btc: number, years: number) => ({ dormantSats: Math.round(btc * 1e8), maxAgeSeconds: yearsToSeconds(years) });

describe("notable awakenings", () => {
  it("needs both 10+ years and 1+ BTC", () => {
    expect(isNotable(ev(10.06, 15.7))).toBe(true);
    expect(isNotable(ev(1, 10))).toBe(true);
    expect(isNotable(ev(0.99, 15))).toBe(false);
    expect(isNotable(ev(500, 9.9))).toBe(false);
  });

  it("puts the longest asleep first, then the largest", () => {
    const list = [ev(27.79, 10.2), ev(10.06, 15.7), ev(3.13, 13.5), ev(5, 13.5)].sort(compareNotable);
    expect(list.map((e) => e.dormantSats / 1e8)).toEqual([10.06, 5, 3.13, 27.79]);
  });
});
