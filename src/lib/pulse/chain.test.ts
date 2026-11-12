import { describe, expect, it } from "vitest";
import { poolFromCoinbase } from "./chain";
import { projectFromHistogram } from "./server";

const hex = (s: string) => Buffer.from(s, "utf8").toString("hex");

describe("poolFromCoinbase", () => {
  it("reads the pool's tag out of the coinbase script", () => {
    expect(poolFromCoinbase("0350e00e" + hex("/Foundry USA Pool #dropgold/") + "00")).toBe("Foundry USA");
    expect(poolFromCoinbase("03" + hex("Mined by AntPool") + "ff")).toBe("AntPool");
    expect(poolFromCoinbase("03" + hex("/ViaBTC/Mined by x/"))).toBe("ViaBTC");
  });
  it("says nothing when there's no known tag", () => {
    expect(poolFromCoinbase("0350e00e" + hex("hello"))).toBeNull();
  });
});

describe("projectFromHistogram", () => {
  it("fills 1,000,000 vB blocks from the highest fee down", () => {
    const blocks = projectFromHistogram({ count: 3000, vsize: 1_500_000, total_fee: 0, fee_histogram: [[10, 600_000], [5, 600_000], [1, 300_000]] });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ vsize: 1_000_000, maxFee: 10, minFee: 5, medianFee: 10, nTx: 2000 });
    expect(blocks[1]).toMatchObject({ vsize: 500_000, minFee: 1 });
  });
  it("is empty without a histogram", () => {
    expect(projectFromHistogram(null)).toEqual([]);
  });
});
