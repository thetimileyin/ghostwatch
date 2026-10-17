import { describe, expect, it } from "vitest";
import block from "./__fixtures__/block-971090.json";
import { btcToSats, detectGhosts, type RpcBlock } from "./detect";

// Real mainnet data: block 971,090 (12 Oct 2026), trimmed to four transactions.
// Header times below were read from the chain for each referenced height.
const HEADER_TIMES: Record<number, number> = {
  613695: 1579526191,
  613702: 1579528993,
  614559: 1580001712,
  614725: 1580100421,
  614726: 1580101563,
  667639: 1611604079,
};

const lookups: number[] = [];
const timeForHeight = async (h: number) => {
  lookups.push(h);
  const t = HEADER_TIMES[h];
  if (t === undefined) throw new Error(`unexpected header lookup for ${h}`);
  return t;
};

describe("detectGhosts on real block 971,090", async () => {
  const events = await detectGhosts(block as RpcBlock, { timeForHeight });
  const mixed = events.find((e) => e.txid.startsWith("99a5520d"))!;

  it("finds only the two transactions that spend 5+ year old outputs", () => {
    expect(events.map((e) => e.txid.slice(0, 8)).sort()).toEqual(["30c4c86a", "99a5520d"]);
  });

  it("ignores the coinbase and a transaction with only young inputs", () => {
    expect(events.some((e) => e.txid.startsWith("4d2f29d0") || e.txid.startsWith("c5d929bc"))).toBe(false);
  });

  it("counts only qualifying inputs in a mixed-age transaction", () => {
    expect(mixed.totalInputCount).toBe(6);
    expect(mixed.dormantInputCount).toBe(5);
    expect(mixed.dormantSats).toBe(70_084_841);
    const young = mixed.inputs.find((i) => i.createdHeight === 971089)!;
    expect(young.qualifies).toBe(false);
    expect(young.valueSats).toBe(39_999_716);
  });

  it("dates the event by its oldest qualifying output, using block timestamps", () => {
    expect(mixed.oldestCreatedHeight).toBe(613695);
    expect(mixed.oldestCreatedTime).toBe(1579526191);
    expect(mixed.maxAgeSeconds).toBe(1791806760 - 1579526191);
    expect(mixed.cohort).toBe(5);
    expect(mixed.id).toBe("99a5520df27a1354");
  });

  it("never looks up header times for young inputs", () => {
    expect(lookups).not.toContain(971089);
    expect(lookups).not.toContain(970646);
  });

  it("is deterministic when the same block is processed twice", async () => {
    const again = await detectGhosts(block as RpcBlock, { timeForHeight });
    expect(again).toEqual(events);
  });

  it("creates no event when the threshold excludes every input", async () => {
    const none = await detectGhosts(block as RpcBlock, { timeForHeight, minYears: 7 });
    expect(none).toEqual([]);
  });
});

describe("btcToSats", () => {
  it("converts Core floats without drift", () => {
    expect(btcToSats(0.05084841)).toBe(5_084_841);
    expect(btcToSats(10000.01104269)).toBe(1_000_001_104_269);
    expect(btcToSats(0.1 + 0.2)).toBe(30_000_000);
  });
});
