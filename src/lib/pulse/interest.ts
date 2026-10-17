import type { PulseTx } from "./types";

// What makes a transaction worth pointing at. Deliberately simple and explainable.
// Note: "value" is the sum of outputs (includes change), so we say "moved", not "sent".

export type TxClass = "whale" | "large" | "rush" | "regular";

export const WHALE_SATS = 100 * 1e8;
export const LARGE_SATS = 10 * 1e8;

export function classifyTx(t: PulseTx, fastestFee: number | null): TxClass {
  if (t.value >= WHALE_SATS) return "whale";
  if (t.value >= LARGE_SATS) return "large";
  const rushLine = Math.max(10, 4 * (fastestFee ?? 2));
  if (t.feeRate >= rushLine) return "rush";
  return "regular";
}

export const CLASS_COPY: Record<TxClass, { simple: string; tag: string }> = {
  whale: { simple: "A very large amount is moving", tag: "100+ BTC" },
  large: { simple: "A large amount is moving", tag: "10+ BTC" },
  rush: { simple: "Someone paid extra to get in faster", tag: "High fee" },
  regular: { simple: "A payment was broadcast", tag: "Tx" },
};
