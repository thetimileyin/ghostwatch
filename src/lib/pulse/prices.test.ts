import { describe, expect, it } from "vitest";
import { roundPrice, summarizePrices } from "./prices";

const t = (y: number, m: number, d: number, h = 12) => Date.UTC(y, m, d, h) / 1000;

describe("summarizePrices", () => {
  const raw = [
    { time: t(2024, 0, 2, 10), USD: 45000 },
    { time: t(2024, 0, 2, 20), USD: 46000 }, // same day: this is the close
    { time: t(2023, 0, 1), USD: 16500 },
    { time: t(2023, 11, 31), USD: 42000 },
    { time: t(2024, 2, 14), USD: 73000 },
    { time: t(2024, 5, 1), USD: 0 }, // bad point, dropped
  ];
  const h = summarizePrices(raw, Date.UTC(2024, 6, 1))!;

  it("keeps one closing price per day, oldest first", () => {
    expect(h.usd).toEqual([16500, 42000, 46000, 73000]);
    expect(h.days).toEqual([...h.days].sort((a, b) => a - b));
  });

  it("finds the all-time high and the first price", () => {
    expect(h.ath.usd).toBe(73000);
    expect(new Date(h.ath.day * 86400_000).toISOString().slice(0, 10)).toBe("2024-03-14");
    expect(h.first.usd).toBe(16500);
  });

  it("summarizes each year and marks partial years", () => {
    const [y23, y24] = h.years;
    expect(y23).toMatchObject({ year: 2023, open: 16500, close: 42000, complete: false }); // first year of the record
    // Opens at 2023's close, and the low counts the intraday 45,000 point, not just closes.
    expect(y24).toMatchObject({ year: 2024, open: 42000, close: 73000, high: 73000, low: 42000, complete: false }); // still running
    expect(y24.change).toBeCloseTo(73000 / 42000 - 1);
  });

  it("returns null without enough data", () => {
    expect(summarizePrices([{ time: 1, USD: 5 }])).toBeNull();
  });
});

describe("roundPrice", () => {
  it("rounds by size", () => {
    expect(roundPrice(126099.4)).toBe(126099);
    expect(roundPrice(13.456)).toBe(13.46);
    expect(roundPrice(0.085841)).toBe(0.0858);
  });
});
