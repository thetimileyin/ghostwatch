import { describe, expect, it } from "vitest";
import { ageBucket, buildJourney, feeVsTypical, isTxid, type RawTx } from "./journey";

const YEAR = 365.2425 * 86400;
const T = 1_700_000_000;

const raw: RawTx = {
  txid: "a".repeat(64),
  vsize: 200,
  weight: 800,
  fee: 0.00001, // 1,000 sats
  blockhash: "b".repeat(64),
  confirmations: 3,
  blocktime: T,
  vin: [
    { txid: "c".repeat(64), vout: 0, prevout: { generated: false, height: 100, value: 1, scriptPubKey: { type: "pubkeyhash", address: "1Old" } } },
    { txid: "d".repeat(64), vout: 1, prevout: { generated: true, height: 200, value: 0.5, scriptPubKey: { type: "witness_v0_keyhash", address: "bc1qme" } } },
  ],
  vout: [
    { n: 0, value: 1.2, scriptPubKey: { type: "witness_v0_keyhash", address: "bc1qthem" } },
    { n: 1, value: 0.29999, scriptPubKey: { type: "witness_v0_keyhash", address: "bc1qme" } },
    { n: 2, value: 0, scriptPubKey: { type: "nulldata" } },
  ],
};
const times = new Map([
  [100, T - 6 * YEAR],
  [200, T - 30 * 86400],
]);

describe("buildJourney", () => {
  const j = buildJourney(raw, times, [{ spent: true, txid: "e".repeat(64), status: { confirmed: true, block_height: 300, block_time: T + 600 } }, { spent: false }, { spent: false }], 250);

  it("measures each input's age and flags five-year-old coins", () => {
    expect(j.inputs.map((i) => i.dormant)).toEqual([true, false]);
    expect(j.inputs[1].minerReward).toBe(true);
    expect(j.inputs[0].createdTime).toBe(T - 6 * YEAR);
  });

  it("labels change only when coins go back to an input's own address", () => {
    expect(j.outputs.map((o) => o.kind)).toEqual(["payment", "change", "data"]);
  });

  it("follows outputs forward", () => {
    expect(j.outputs[0].next).toEqual({ spent: true, txid: "e".repeat(64), height: 300, time: T + 600 });
    expect(j.outputs[1].next).toEqual({ spent: false });
  });

  it("works out totals, fee and rate", () => {
    expect(j.totalInSats).toBe(150_000_000);
    expect(j.feeSats).toBe(1000);
    expect(j.feeRate).toBe(5);
    expect(j).toMatchObject({ confirmed: true, blockHeight: 250, confirmations: 3 });
  });

  it("treats a coinbase as new coins with no inputs or fee", () => {
    const cb = buildJourney({ ...raw, fee: undefined, vin: [{ coinbase: "03abcd" }] }, new Map(), null, 250);
    expect(cb).toMatchObject({ coinbase: true, inputs: [], feeSats: null });
    expect(cb.outputs.every((o) => o.next === null)).toBe(true);
  });

  it("handles a transaction still waiting", () => {
    const w = buildJourney({ ...raw, blockhash: undefined, confirmations: undefined, blocktime: undefined }, times, null, null);
    expect(w).toMatchObject({ confirmed: false, blockHeight: null, blockTime: null, confirmations: 0 });
  });
});

describe("helpers", () => {
  it("recognises transaction IDs", () => {
    expect(isTxid("A".repeat(64))).toBe(true);
    expect(isTxid("a".repeat(63))).toBe(false);
    expect(isTxid("bc1qxyz")).toBe(false);
  });

  it("buckets ages and compares fees", () => {
    expect(ageBucket(3600)).toBe("hours");
    expect(ageBucket(40 * 86400)).toBe("months");
    expect(ageBucket(6 * YEAR)).toBe("dormant");
    expect(feeVsTypical(2, 2)).toBe("about");
    expect(feeVsTypical(10, 2)).toBe("well above");
    expect(feeVsTypical(0.5, 2)).toBe("well below");
  });
});
