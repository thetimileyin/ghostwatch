/**
 * Outside data sources, with fallbacks. mempool.space is used when it answers, but nothing
 * depends on it alone: it rate-limits busy callers (it blocked this server for days), so
 *  - a 429 or three failures in a row set it aside for 10 minutes (no waiting on timeouts);
 *  - Esplora-format calls fall back to Blockstream's public API (same format);
 *  - mempool-only extras (pools, Lightning, projections) simply come back null.
 * All calls run on our server; visitors' browsers never contact these services.
 */

export const MEMPOOL = (process.env.MEMPOOL_API ?? "https://mempool.space/api").replace(/\/$/, "");
export const BLOCKSTREAM = (process.env.ESPLORA_FALLBACK_API ?? "https://blockstream.info/api").replace(/\/$/, "");

// mempool.space is set aside for 10 minutes (it was blocking us); anything else only for a
// minute, so a fallback is never lost for long. One slow or failed request (a big address,
// a hiccup) doesn't count: it takes a 429 or three failures in a row.
const DOWN_MS = 10 * 60_000;
const FALLBACK_DOWN_MS = 60_000;
const STRIKES = 3;
const state = globalThis as unknown as { gwSourceDown?: Record<string, number>; gwSourceStrikes?: Record<string, number> };
const down = (state.gwSourceDown ??= {});
const strikes = (state.gwSourceStrikes ??= {});

const isDown = (base: string) => (down[base] ?? 0) > Date.now();
const markDown = (base: string) => {
  down[base] = Date.now() + (base === MEMPOOL ? DOWN_MS : FALLBACK_DOWN_MS);
  strikes[base] = 0;
};
const strike = (base: string) => {
  strikes[base] = (strikes[base] ?? 0) + 1;
  if (strikes[base] >= STRIKES) markDown(base);
};

/** Is mempool.space currently usable (not marked down)? */
export const mempoolUp = () => !isDown(MEMPOOL);

export type Fetched<T> = { ok: true; data: T } | { ok: false; status: number | null };

async function call<T>(base: string, path: string, timeoutMs: number, as: "json" | "text"): Promise<Fetched<T>> {
  if (isDown(base)) return { ok: false, status: null };
  try {
    const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store", headers: { accept: as === "json" ? "application/json" : "text/plain", "user-agent": "GhostWatch" } });
    if (res.status === 429) {
      markDown(base); // rate limited: give it a rest
      return { ok: false, status: res.status };
    }
    if (res.status >= 500) {
      strike(base);
      return { ok: false, status: res.status };
    }
    strikes[base] = 0;
    if (!res.ok) return { ok: false, status: res.status }; // e.g. 400/404: a real answer about this input
    return { ok: true, data: (as === "json" ? await res.json() : await res.text()) as T };
  } catch {
    strike(base); // no connection / timeout
    return { ok: false, status: null };
  }
}

/** mempool.space-only endpoints (/v1/...): null when it's down or says no. */
export async function fromMempool<T>(path: string, timeoutMs = 6000): Promise<T | null> {
  const r = await call<T>(MEMPOOL, path, timeoutMs, "json");
  return r.ok ? r.data : null;
}

/**
 * Esplora-format endpoints (/tx, /address, /block, /mempool...): mempool.space first, then
 * Blockstream. A 4xx from the first is a real answer (bad input) and is returned as is.
 */
export async function fromEsplora<T>(path: string, timeoutMs = 8000, as: "json" | "text" = "json"): Promise<Fetched<T>> {
  const first = await call<T>(MEMPOOL, path, timeoutMs, as);
  if (first.ok || (first.status != null && first.status < 500 && first.status !== 429)) return first;
  return call<T>(BLOCKSTREAM, path, timeoutMs, as);
}

export async function esploraJson<T>(path: string, timeoutMs = 8000): Promise<T | null> {
  const r = await fromEsplora<T>(path, timeoutMs);
  return r.ok ? r.data : null;
}

/** Any other public JSON API (price sources), with the same down-marking. */
export async function fromApi<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  const u = new URL(url);
  const r = await call<T>(u.origin, `${u.pathname}${u.search}`, timeoutMs, "json");
  return r.ok ? r.data : null;
}
