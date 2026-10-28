import type { NodePlace, NodeShare, NodeSummary, NodesSnapshot } from "./types";

// Bitnodes / btcnodes.io snapshot format. Each node is keyed by its address:
// [protocol, user_agent, connected_since, services, height, hostname, city, country, lat, lng, timezone, asn, org]
export interface RawSnapshot {
  timestamp: number;
  total_nodes: number;
  latest_height?: number;
  nodes: Record<string, unknown[]>;
}

/**
 * Bitcoin node software from its user agent, in plain words.
 * "/Satoshi:28.1.0/" -> "Bitcoin Core 28.1"; "/Satoshi:28.1.0/Knots:20250305/" -> "Bitcoin Knots".
 */
export function softwareName(ua: unknown): string {
  const s = typeof ua === "string" ? ua : "";
  if (/knots/i.test(s)) return "Bitcoin Knots";
  const core = s.match(/^\/Satoshi:(\d+)\.(\d+)/);
  if (core) return `Bitcoin Core ${core[1]}.${core[2]}`;
  const other = s.match(/^\/([A-Za-z][\w .-]*?)[:/]/);
  return other ? other[1] : "Other";
}

/** Top labels by count, with everything else folded into "Other". */
function shares(counts: Map<string, number>, total: number, top: number): NodeShare[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, top).map(([label, n]) => ({ label, share: n / total }));
  const rest = sorted.slice(top).reduce((n, [, c]) => n + c, 0);
  if (rest > 0) head.push({ label: "Other", share: rest / total });
  return head;
}

/**
 * Turn a full snapshot into what the site shows: map points, per-place counts and a
 * network summary. Addresses, hostnames, ASNs and providers are read here and dropped:
 * nothing that identifies an operator leaves this function.
 */
export function aggregateNodes(raw: RawSnapshot): NodesSnapshot {
  const entries = Object.entries(raw.nodes ?? {});
  const best = raw.latest_height ?? Math.max(0, ...entries.map(([, v]) => Number(v[4]) || 0));
  const points: [number, number][] = [];
  const byPlace = new Map<string, { lat: number; lng: number; n: number; name: string; versions: Map<string, number>; synced: number }>();
  const countries = new Map<string, number>();
  const versions = new Map<string, number>();
  let tor = 0;
  let synced = 0;

  for (const [addr, v] of entries) {
    const sw = softwareName(v[1]);
    const height = Number(v[4]) || 0;
    const ok = best > 0 && height >= best - 2;
    versions.set(sw, (versions.get(sw) ?? 0) + 1);
    if (ok) synced++;
    const lat = typeof v[8] === "number" ? v[8] : null;
    const lng = typeof v[9] === "number" ? v[9] : null;
    if (addr.includes(".onion") || lat == null || lng == null) {
      if (addr.includes(".onion")) tor++;
      continue;
    }
    points.push([lat, lng]);
    const country = typeof v[7] === "string" && v[7] ? v[7] : "??";
    countries.set(country, (countries.get(country) ?? 0) + 1);
    const city = typeof v[6] === "string" && v[6] ? v[6] : null;
    // Group by city; without a city, by country and a coarse 1-degree cell.
    const key = city ? `${country}|${city}` : `${country}|${Math.round(lat)},${Math.round(lng)}`;
    const p = byPlace.get(key) ?? { lat: 0, lng: 0, n: 0, name: city ? `${city}, ${country}` : country, versions: new Map(), synced: 0 };
    p.lat += lat;
    p.lng += lng;
    p.n++;
    p.versions.set(sw, (p.versions.get(sw) ?? 0) + 1);
    if (ok) p.synced++;
    byPlace.set(key, p);
  }

  const places: NodePlace[] = [...byPlace.values()].map((p) => ({
    lat: +(p.lat / p.n).toFixed(2),
    lng: +(p.lng / p.n).toFixed(2),
    name: p.name,
    count: p.n,
    versions: shares(p.versions, p.n, 3),
    synced: p.synced / p.n,
  }));

  const total = entries.length || raw.total_nodes;
  const located = points.length || 1;
  const summary: NodeSummary = {
    total,
    tor,
    countries: points.length ? shares(countries, located, 6) : [],
    versions: shares(versions, total || 1, 5),
    // Every version (no "Other"), so a brand-new release can be shown while it's still small.
    versionsAll: [...versions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([label, n]) => ({ label, share: n / (total || 1) })),
    synced: total ? synced / total : 0,
  };
  return { timestamp: raw.timestamp, totalNodes: raw.total_nodes || total, points, places, summary };
}
