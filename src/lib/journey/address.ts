/**
 * An address's story: what it holds now, how old those coins are, what came and went,
 * and whether its public key is already visible on the chain. Public data only: an
 * address isn't a person, and GhostWatch never attaches names to one.
 */

const B58 = "[1-9A-HJ-NP-Za-km-z]";
const B32 = "[02-9ac-hj-np-z]";

/** Bitcoin Core's script type for a mainnet address, or null when it isn't one. */
export function addressType(input: string): string | null {
  const a = input.trim();
  const lower = a.toLowerCase();
  if (/^bc1/i.test(a)) {
    if (a !== lower && a !== a.toUpperCase()) return null; // bech32 can't mix case
    if (new RegExp(`^bc1p${B32}{58}$`).test(lower)) return "witness_v1_taproot";
    if (new RegExp(`^bc1q${B32}{38}$`).test(lower)) return "witness_v0_keyhash";
    if (new RegExp(`^bc1q${B32}{58}$`).test(lower)) return "witness_v0_scripthash";
    return null;
  }
  if (new RegExp(`^1${B58}{25,33}$`).test(a)) return "pubkeyhash";
  if (new RegExp(`^3${B58}{25,33}$`).test(a)) return "scripthash";
  return null;
}

export const isAddress = (s: string) => addressType(s) != null;
/** bech32 addresses are case-insensitive; keep them in their usual lowercase. */
export const normalizeAddress = (s: string) => (/^bc1/i.test(s.trim()) ? s.trim().toLowerCase() : s.trim());

// mempool.space shapes
export interface RawAddressStats {
  chain_stats: { funded_txo_count: number; funded_txo_sum: number; spent_txo_count: number; spent_txo_sum: number; tx_count: number };
  mempool_stats: { funded_txo_count: number; funded_txo_sum: number; spent_txo_count: number; spent_txo_sum: number; tx_count: number };
}
export interface RawUtxo {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean; block_height?: number; block_time?: number };
}
export interface RawAddrTx {
  txid: string;
  status: { confirmed: boolean; block_height?: number; block_time?: number };
  vin: { prevout: { scriptpubkey_address?: string; value: number } | null }[];
  vout: { scriptpubkey_address?: string; value: number }[];
}

export interface HeldCoin {
  txid: string;
  vout: number;
  valueSats: number;
  /** When it arrived (block time), or null while that transaction is still waiting. */
  arrivedTime: number | null;
  arrivedHeight: number | null;
}

export interface AddressActivity {
  txid: string;
  time: number | null;
  height: number | null;
  /** Net change for this address: positive received, negative sent. */
  netSats: number;
}

export type KeyExposure =
  | { exposed: true; why: "taproot" | "spent" }
  | { exposed: false; why: "never-spent" | "script" };

export interface AddressStory {
  address: string;
  type: string;
  balanceSats: number;
  /** Change still waiting to confirm (positive incoming, negative outgoing). */
  pendingSats: number;
  receivedSats: number;
  sentSats: number;
  receivedCount: number;
  spentCount: number;
  txCount: number;
  /** Coins it holds, largest first; null when there are too many to list. */
  coins: HeldCoin[] | null;
  /** Most recent activity, newest first (up to ~25 confirmed plus any waiting). */
  recent: AddressActivity[];
  /** The full history fit in `recent`, so its oldest entry is the address's first use. */
  historyComplete: boolean;
  key: KeyExposure;
}

/**
 * Whether the public key behind an address is visible on the chain. Taproot outputs carry
 * the key itself; other single-key addresses reveal it the first time they spend. Script
 * addresses (3…, long bc1q…) reveal their script, keys included, when they spend.
 */
export function keyExposure(type: string, spentCount: number): KeyExposure {
  if (type === "witness_v1_taproot") return { exposed: true, why: "taproot" };
  if (spentCount > 0) return { exposed: true, why: "spent" };
  return type === "scripthash" || type === "witness_v0_scripthash" ? { exposed: false, why: "script" } : { exposed: false, why: "never-spent" };
}

export function buildAddressStory(address: string, stats: RawAddressStats, utxos: RawUtxo[] | null, txs: RawAddrTx[]): AddressStory {
  const type = addressType(address) ?? "unknown";
  const c = stats.chain_stats;
  const m = stats.mempool_stats;
  const coins = utxos
    ? [...utxos]
        .sort((a, b) => b.value - a.value)
        .map((u) => ({
          txid: u.txid,
          vout: u.vout,
          valueSats: u.value,
          arrivedTime: u.status.confirmed ? (u.status.block_time ?? null) : null,
          arrivedHeight: u.status.confirmed ? (u.status.block_height ?? null) : null,
        }))
    : null;
  const recent = txs.map((t) => {
    const out = t.vout.filter((o) => o.scriptpubkey_address === address).reduce((s, o) => s + o.value, 0);
    const spent = t.vin.filter((v) => v.prevout?.scriptpubkey_address === address).reduce((s, v) => s + (v.prevout?.value ?? 0), 0);
    return {
      txid: t.txid,
      time: t.status.confirmed ? (t.status.block_time ?? null) : null,
      height: t.status.confirmed ? (t.status.block_height ?? null) : null,
      netSats: out - spent,
    };
  });
  return {
    address,
    type,
    balanceSats: c.funded_txo_sum - c.spent_txo_sum,
    pendingSats: m.funded_txo_sum - m.spent_txo_sum,
    receivedSats: c.funded_txo_sum,
    sentSats: c.spent_txo_sum,
    receivedCount: c.funded_txo_count,
    spentCount: c.spent_txo_count,
    txCount: c.tx_count + m.tx_count,
    coins,
    recent,
    historyComplete: txs.length >= c.tx_count + m.tx_count,
    key: keyExposure(type, c.spent_txo_count + m.spent_txo_count),
  };
}
