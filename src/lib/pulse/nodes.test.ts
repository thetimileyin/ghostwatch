import { describe, expect, it } from "vitest";
import { aggregateNodes, softwareName } from "./nodes";

const node = (ua: string, height: number, city: string | null, country: string, lat: number | null, lng: number | null) =>
  [70016, ua, 1700000000, 1033, height, "host.example", city, country, lat, lng, "UTC", "AS64500", "Example Hosting"];

describe("softwareName", () => {
  it("names common clients plainly", () => {
    expect(softwareName("/Satoshi:28.1.0/")).toBe("Bitcoin Core 28.1");
    expect(softwareName("/Satoshi:28.1.0/Knots:20250305/")).toBe("Bitcoin Knots");
    expect(softwareName("/btcd:0.24.2/")).toBe("btcd");
    expect(softwareName(null)).toBe("Other");
  });
});

describe("aggregateNodes", () => {
  const raw = {
    timestamp: 1,
    total_nodes: 5,
    latest_height: 900000,
    nodes: {
      "203.0.113.1:8333": node("/Satoshi:28.1.0/", 900000, "Frankfurt", "DE", 50.11, 8.68),
      "203.0.113.2:8333": node("/Satoshi:27.0.0/", 899999, "Frankfurt", "DE", 50.13, 8.66),
      "203.0.113.3:8333": node("/Satoshi:28.1.0/Knots:20250305/", 899000, null, "US", 37.7, -97.8),
      "abcdefghijklmnop.onion:8333": node("/Satoshi:28.1.0/", 900000, null, "", null, null),
      "[2001:db8::1]:8333": node("/Satoshi:28.1.0/", 900000, "Frankfurt", "DE", 50.12, 8.67),
    },
  };
  const out = aggregateNodes(raw);

  it("groups by place and counts tor separately", () => {
    expect(out.points).toHaveLength(4);
    expect(out.summary?.tor).toBe(1);
    const fra = out.places?.find((p) => p.name === "Frankfurt, DE");
    expect(fra?.count).toBe(3);
    expect(fra?.synced).toBe(1);
  });

  it("never leaks addresses, hostnames or providers", () => {
    const json = JSON.stringify(out);
    for (const secret of ["203.0.113", "2001:db8", ".onion", "host.example", "AS64500", "Example Hosting"]) expect(json).not.toContain(secret);
  });

  it("summarises software and sync", () => {
    expect(out.summary?.versions[0]).toEqual({ label: "Bitcoin Core 28.1", share: 3 / 5 });
    expect(out.summary?.synced).toBe(4 / 5);
  });
});

describe("versionsAll", () => {
  it("keeps every version's share, so a small new release is visible", async () => {
    const { aggregateNodes } = await import("./nodes");
    const nodes: Record<string, unknown[]> = {};
    for (let i = 0; i < 99; i++) nodes[`10.0.0.${i}:8333`] = [70016, "/Satoshi:31.1.0/", 0, 0, 100];
    nodes["10.0.1.1:8333"] = [70016, "/Satoshi:32.1.0/", 0, 0, 100];
    const s = aggregateNodes({ timestamp: 1, total_nodes: 100, nodes }).summary!;
    expect(s.versionsAll?.find((v) => v.label === "Bitcoin Core 32.1")?.share).toBeCloseTo(0.01);
  });
});
