// Shared plumbing for journey lookups: a small cache, a cap on lookups at once, and
// fetches that fail quietly. Everything runs on our server; nothing is logged.

export const MEMPOOL = (process.env.MEMPOOL_API ?? "https://mempool.space/api").replace(/\/$/, "");

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

/** JSON or null; `status` is set when the source answered with an error. */
export async function getJson<T>(url: string, timeoutMs = 10_000): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store", headers: { accept: "application/json" } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Like getJson, but tells apart "the source said no" (with its message) from "no answer". */
export async function getJsonOrReason<T>(url: string, timeoutMs = 10_000): Promise<{ ok: true; data: T } | { ok: false; status: number | null; text: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store", headers: { accept: "application/json" } });
    if (res.ok) return { ok: true, data: (await res.json()) as T };
    return { ok: false, status: res.status, text: await res.text().catch(() => "") };
  } catch {
    return { ok: false, status: null, text: "" };
  }
}

export const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
