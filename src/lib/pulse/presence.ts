// Anonymous "watching now" count. Each open tab makes up a random code in memory
// (never stored, never tied to an IP) and sends it with its live-update polls.
// We remember codes for a few seconds, count them, and forget them.

const WINDOW_MS = 15_000;
const MAX_TABS = 50_000; // memory guard against junk codes
const CODE = /^[a-f0-9]{32}$/;

const seen = ((globalThis as unknown as { gwPresence?: Map<string, number> }).gwPresence ??= new Map());

/** Records a tab's poll. Ignores anything that isn't a well-formed code. */
export function touch(code: string | null) {
  if (!code || !CODE.test(code)) return;
  if (!seen.has(code) && seen.size >= MAX_TABS) return;
  seen.set(code, Date.now());
}

/** A tab said goodbye (closed, reloaded or navigated away): stop counting it now. */
export function leave(code: string | null) {
  if (code && CODE.test(code)) seen.delete(code);
}

/** Tabs that polled in the last few seconds. Forgets everything older. */
export function watching(): number {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [code, at] of seen) if (at < cutoff) seen.delete(code);
  return seen.size;
}
