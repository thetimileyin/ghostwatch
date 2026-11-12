// Shared plumbing for journey lookups: a small cache, a cap on lookups at once, and
// fetches that fail quietly. Everything runs on our server; nothing is logged.

import { MEMPOOL, fromApi, fromEsplora, fromMempool, type Fetched } from "@/lib/sources";
export { MEMPOOL };

const state = globalThis as unknown as {
  gwLookupCache?: Map<string, { at: number; ttl: number; value: unknown }>;
  gwLookupSlots?: { busy: number; queue: (() => void)[] };
};
const cache = (state.gwLookupCache ??= new Map());
const slots = (state.gwLookupSlots ??= { busy: 0, queue: [] });
const MAX_CACHED = 500;
const MAX_BUSY = 3; // lookups at once; the rest wait their turn

export async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (slots.busy >= MAX_BUSY) await new Promise<void>((r) => slots.queue.push(r));
  slots.busy++;
  try {
    return await fn();
  } finally {
    slots.busy--;
    slots.queue.shift()?.();
  }
}

/** Cached lookup: `ttlFor` decides how long a result stays (0 = don't keep it). */
export async function cached<T>(key: string, load: () => Promise<T>, ttlFor: (v: T) => number): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as T;
  const value = await withSlot(load);
  const ttl = ttlFor(value);
  if (ttl > 0) {
    cache.set(key, { at: Date.now(), ttl, value });
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  }
  return value;
}

/** Turn a mempool.space URL into a call through the fallback layer (see lib/sources.ts). */
function viaSources<T>(url: string, timeoutMs: number) {
  const path = url.startsWith(MEMPOOL) ? url.slice(MEMPOOL.length) : null;
  if (path == null) return null;
  return path.startsWith("/v1/")
    ? fromMempool<T>(path, timeoutMs).then((d): Fetched<T> => (d == null ? { ok: false, status: null } : { ok: true, data: d }))
    : fromEsplora<T>(path, timeoutMs);
}

/** JSON or null. mempool.space URLs fall back to Blockstream when it's unreachable. */
export async function getJson<T>(url: string, timeoutMs = 10_000): Promise<T | null> {
  const r = await (viaSources<T>(url, timeoutMs) ?? fromApi<T>(url, timeoutMs).then((d): Fetched<T> => (d == null ? { ok: false, status: null } : { ok: true, data: d })));
  return r.ok ? r.data : null;
}

/** Like getJson, but tells apart "the source said no" (with its status) from "no answer". */
export async function getJsonOrReason<T>(url: string, timeoutMs = 10_000): Promise<{ ok: true; data: T } | { ok: false; status: number | null; text: string }> {
  const r = await (viaSources<T>(url, timeoutMs) ?? fromApi<T>(url, timeoutMs).then((d): Fetched<T> => (d == null ? { ok: false, status: null } : { ok: true, data: d })));
  return r.ok ? r : { ok: false, status: r.status, text: "" };
}

export const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
