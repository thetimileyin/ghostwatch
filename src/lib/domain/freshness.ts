import type { FeedState } from "./types";

/** Heartbeat younger than this and caught up: live. */
export const LIVE_MAX_HEARTBEAT_S = 5 * 60;
/** Heartbeat older than this: stopped. */
export const STOPPED_AFTER_S = 60 * 60;
/** Blocks behind the observed tip before we call the feed delayed. */
export const MAX_LAG_BLOCKS = 2;

/** Never reports "live" unless the worker polled recently and is caught up. */
export function classify(heartbeatAge: number | null, lag: number | null): FeedState {
  if (heartbeatAge === null) return "unknown";
  if (heartbeatAge >= STOPPED_AFTER_S) return "stopped";
  if (heartbeatAge > LIVE_MAX_HEARTBEAT_S || (lag !== null && lag > MAX_LAG_BLOCKS)) return "delayed";
  return "live";
}
