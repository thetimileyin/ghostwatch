/** What a watched coin looks like now; the browser compares it with what it saw before. */
export type WatchState =
  | { kind: "tx"; confirmed: boolean; outputs: number; spent: number }
  | { kind: "address"; txCount: number; balanceSats: number };

/** Plain words for what changed between two checks, or null when nothing did. */
export function describeChange(prev: WatchState, next: WatchState): string | null {
  if (prev.kind === "tx" && next.kind === "tx") {
    if (!prev.confirmed && next.confirmed) return "It was confirmed in a block.";
    if (next.spent > prev.spent) {
      const n = next.spent - prev.spent;
      return n === 1 ? "One of its coins moved on." : `${n} of its coins moved on.`;
    }
    return null;
  }
  if (prev.kind === "address" && next.kind === "address") {
    if (next.txCount > prev.txCount) {
      const d = next.balanceSats - prev.balanceSats;
      return d > 0 ? "New coins arrived." : d < 0 ? "Coins were sent from it." : "It had new activity.";
    }
    return null;
  }
  return null;
}

