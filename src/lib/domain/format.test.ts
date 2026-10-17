import { describe, expect, it } from "vitest";
import { classify } from "./freshness";
import { btcShort, durationLong, durationShort, middleTruncate, satsToBtcString, splitBtc } from "./format";
import { calendarSpan, cohortFor, yearsToSeconds } from "./time";

describe("amounts", () => {
  it("prints full precision from integer sats", () => {
    expect(satsToBtcString(70_084_841)).toBe("0.70084841");
    expect(satsToBtcString(1_000_001_104_269)).toBe("10,000.01104269");
  });
  it("splits head and dim tail", () => {
    expect(splitBtc(70_084_841)).toEqual({ head: "0.70", tail: "084841" });
  });
  it("compacts for headlines", () => {
    expect(btcShort(1_000_001_104_269)).toBe("10,000.01 BTC");
    expect(btcShort(70_084_841)).toBe("0.7008 BTC");
  });
});

describe("durations", () => {
  const created = 1579526191; // 2020-01-20
  const spent = 1791806760; // 2026-10-12
  it("matches the calendar", () => {
    expect(calendarSpan(created, spent)).toMatchObject({ years: 6, months: 8, days: 22, totalDays: 2456 });
    expect(durationShort(created, spent)).toBe("6y 8m 22d");
    expect(durationLong(created, spent)).toBe("6 years and 8 months");
  });
  it("assigns cohorts by threshold", () => {
    expect(cohortFor(yearsToSeconds(4.99))).toBeNull();
    expect(cohortFor(yearsToSeconds(5))).toBe(5);
    expect(cohortFor(yearsToSeconds(14.2))).toBe(10);
    expect(cohortFor(yearsToSeconds(15))).toBe(15);
  });
});

describe("feed freshness", () => {
  it("never calls stale data live", () => {
    expect(classify(null, null)).toBe("unknown");
    expect(classify(30, 0)).toBe("live");
    expect(classify(30, 5)).toBe("delayed");
    expect(classify(10 * 60, 0)).toBe("delayed");
    expect(classify(2 * 3600, 0)).toBe("stopped");
  });
});

describe("middleTruncate", () => {
  it("keeps both ends", () => {
    expect(middleTruncate("99a5520df27a13548b2199ab7d75daf74ffdf0e4412135ffd3fc4b570a570727")).toBe("99a5520d…0a570727");
  });
});
