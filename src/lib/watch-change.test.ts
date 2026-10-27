import { describe, expect, it } from "vitest";
import { describeChange } from "./watch-change";

describe("describeChange", () => {
  const tx = (confirmed: boolean, spent: number) => ({ kind: "tx" as const, confirmed, outputs: 3, spent });
  const addr = (txCount: number, balanceSats: number) => ({ kind: "address" as const, txCount, balanceSats });

  it("notices a transaction confirming, then its coins moving on", () => {
    expect(describeChange(tx(false, 0), tx(true, 0))).toBe("It was confirmed in a block.");
    expect(describeChange(tx(true, 0), tx(true, 1))).toBe("One of its coins moved on.");
    expect(describeChange(tx(true, 1), tx(true, 3))).toBe("2 of its coins moved on.");
    expect(describeChange(tx(true, 1), tx(true, 1))).toBeNull();
  });

  it("notices address activity and which way coins went", () => {
    expect(describeChange(addr(2, 100), addr(3, 150))).toBe("New coins arrived.");
    expect(describeChange(addr(2, 100), addr(3, 0))).toBe("Coins were sent from it.");
    expect(describeChange(addr(2, 100), addr(3, 100))).toBe("It had new activity.");
    expect(describeChange(addr(2, 100), addr(2, 100))).toBeNull();
  });
});
