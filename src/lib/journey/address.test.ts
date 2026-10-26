import { describe, expect, it } from "vitest";
import { addressType, buildAddressStory, keyExposure, normalizeAddress } from "./address";

describe("addressType", () => {
  it("recognises each mainnet address type", () => {
    expect(addressType("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe("pubkeyhash");
    expect(addressType("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy")).toBe("scripthash");
    expect(addressType("bc1qwq5geath93h0lnfsrmnwnfuck2f9ypv4ewyl4j")).toBe("witness_v0_keyhash");
    expect(addressType("BC1QWQ5GEATH93H0LNFSRMNWNFUCK2F9YPV4EWYL4J")).toBe("witness_v0_keyhash");
    expect(addressType("bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3")).toBe("witness_v0_scripthash");
    expect(addressType("bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297")).toBe("witness_v1_taproot");
  });

  it("rejects things that aren't addresses", () => {
    for (const bad of ["bc1qnotreal", "Bc1qwq5geath93h0lnfsrmnwnfuck2f9ypv4ewyl4j", "0xabc", "a".repeat(64), "", "1O0Il"]) expect(addressType(bad)).toBeNull();
  });

  it("lowercases bech32 and leaves base58 alone", () => {
    expect(normalizeAddress(" BC1QWQ5GEATH93H0LNFSRMNWNFUCK2F9YPV4EWYL4J ")).toBe("bc1qwq5geath93h0lnfsrmnwnfuck2f9ypv4ewyl4j");
    expect(normalizeAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
  });
});

describe("keyExposure", () => {
  it("follows how each type reveals its key", () => {
    expect(keyExposure("witness_v1_taproot", 0)).toEqual({ exposed: true, why: "taproot" });
    expect(keyExposure("witness_v0_keyhash", 2)).toEqual({ exposed: true, why: "spent" });
    expect(keyExposure("pubkeyhash", 0)).toEqual({ exposed: false, why: "never-spent" });
    expect(keyExposure("scripthash", 0)).toEqual({ exposed: false, why: "script" });
  });
});

describe("buildAddressStory", () => {
  const A = "bc1qwq5geath93h0lnfsrmnwnfuck2f9ypv4ewyl4j";
  const stats = {
    chain_stats: { funded_txo_count: 3, funded_txo_sum: 300, spent_txo_count: 1, spent_txo_sum: 100, tx_count: 2 },
    mempool_stats: { funded_txo_count: 1, funded_txo_sum: 50, spent_txo_count: 0, spent_txo_sum: 0, tx_count: 1 },
  };
  const txs = [
    { txid: "t3", status: { confirmed: false }, vin: [{ prevout: { scriptpubkey_address: "other", value: 60 } }], vout: [{ scriptpubkey_address: A, value: 50 }] },
    { txid: "t2", status: { confirmed: true, block_height: 2, block_time: 2000 }, vin: [{ prevout: { scriptpubkey_address: A, value: 100 } }], vout: [{ scriptpubkey_address: "x", value: 90 }] },
    { txid: "t1", status: { confirmed: true, block_height: 1, block_time: 1000 }, vin: [{ prevout: null }], vout: [{ scriptpubkey_address: A, value: 100 }, { scriptpubkey_address: A, value: 200 }] },
  ];
  const utxos = [
    { txid: "t1", vout: 1, value: 200, status: { confirmed: true, block_height: 1, block_time: 1000 } },
    { txid: "t3", vout: 0, value: 50, status: { confirmed: false } },
  ];
  const s = buildAddressStory(A, stats, utxos, txs);

  it("totals balance, pending and activity", () => {
    expect(s).toMatchObject({ balanceSats: 200, pendingSats: 50, receivedSats: 300, sentSats: 100, txCount: 3, historyComplete: true });
    expect(s.recent.map((r) => r.netSats)).toEqual([50, -100, 300]);
  });

  it("lists coins largest first with when they arrived", () => {
    expect(s.coins?.map((c) => [c.valueSats, c.arrivedTime])).toEqual([[200, 1000], [50, null]]);
    expect(s.key).toEqual({ exposed: true, why: "spent" });
  });

  it("shows totals only when there are too many coins to list", () => {
    expect(buildAddressStory(A, stats, null, []).coins).toBeNull();
  });
});
