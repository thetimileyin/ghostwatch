import type { NodePlace } from "@/lib/pulse/types";
import { CITIES } from "./cities";

/** Points farther than this from every listed city are grouped by a coarse grid cell instead. */
const NEAR_KM = 350;
const RAD = Math.PI / 180;

function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const a = Math.sin(((lat2 - lat1) * RAD) / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(((lng2 - lng1) * RAD) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const coord = (lat: number, lng: number) =>
  `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(0)}°${lng >= 0 ? "E" : "W"}`;

/**
 * Group map points into areas named after the nearest major city ("Near Frankfurt, DE").
 * The source only publishes coordinates, so the city is an estimate and is labelled "near";
 * points with no city within 350 km fall into a 5-degree cell named by its coordinates.
 */
export function nodeAreas(points: [number, number][]): NodePlace[] {
  const groups = new Map<string, { lat: number; lng: number; n: number; name: string }>();
  for (const [lat, lng] of points) {
    let best = -1;
    let bestKm = NEAR_KM;
    for (let i = 0; i < CITIES.length; i++) {
      const c = CITIES[i];
      if (Math.abs(c[2] - lat) > 4) continue; // ~444 km of latitude: cheap reject
      const d = km(lat, lng, c[2], c[3]);
      if (d < bestKm) {
        bestKm = d;
        best = i;
      }
    }
    let key: string;
    let name: string;
    if (best >= 0) {
      key = `c${best}`;
      name = `Near ${CITIES[best][0]}, ${CITIES[best][1]}`;
    } else {
      const cl = Math.floor(lat / 5) * 5 + 2.5;
      const cg = Math.floor(lng / 5) * 5 + 2.5;
      key = `g${cl},${cg}`;
      name = `Around ${coord(cl, cg)}`;
    }
    const g = groups.get(key) ?? { lat: 0, lng: 0, n: 0, name };
    g.lat += lat;
    g.lng += lng;
    g.n++;
    groups.set(key, g);
  }
  const total = points.length || 1;
  return [...groups.values()]
    .map((g) => ({ lat: +(g.lat / g.n).toFixed(2), lng: +(g.lng / g.n).toFixed(2), name: g.name, count: g.n, share: g.n / total }))
    .sort((a, b) => b.count - a.count);
}
