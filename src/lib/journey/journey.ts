/**
 * A transaction's journey: where its coins came from, where they went, what it cost,
 * and which block it landed in. Built from public chain data only; nothing here says who
 * sent or received anything.
 */

import { yearsToSeconds } from "@/lib/domain/time";

/** Coins unspent this long count as an awakening, the same rule as the detector. */
export const DORMANT_SECONDS = yearsToSeconds(5);

export const isTxid = (s: string) => /^[0-9a-f]{64}$/i.test(s.trim());

// Bitcoin Core `getrawtransaction <txid> 2`: inputs carry the output they spend.
export interface RawScript {
  type: string;
  address?: string;
}
export interface RawTx {
  txid: string;
  vsize: number;
  weight: number;
  fee?: number; // BTC
  blockhash?: string;
  confirmations?: number;
  blocktime?: number;
  vin: { txid?: string; vout?: number; coinbase?: string; prevout?: { generated: boolean; height: number; value: number; scriptPubKey: RawScript } }[];
  vout: { n: number; value: number; scriptPubKey: RawScript }[];
}

/** mempool.space `/api/tx/:txid/outspends`: whether each output has been spent since, and by what. */
export interface RawOutspend {
  spent: boolean;
  txid?: string;
  status?: { confirmed: boolean; block_height?: number; block_time?: number };
}

export interface JourneyInput {
  index: number;
  prevTxid: string;
  prevVout: number;
  valueSats: number;
  address: string | null;
  scriptType: string | null;
  /** Block that created the coin, or null when it was created by a transaction still waiting. */
  createdHeight: number | null;
  createdTime: number | null;
  /** The coin was a miner's reward (created by a coinbase transaction). */
  minerReward: boolean;
  /** Unspent for five years or more before this transaction. */
  dormant: boolean;
}

export interface JourneyOutput {
  index: number;
  valueSats: number;
  address: string | null;
  scriptType: string | null;
  /** "change": same address as one of the inputs. "data": an OP_RETURN note that holds no coins. */
  kind: "payment" | "change" | "data";
  /** Spent since? null when unknown. */
  next: { spent: false } | { spent: true; txid: string; height: number | null; time: number | null } | null;
}

export interface Journey {
  txid: string;
  /** A coinbase transaction creates new coins for a miner instead of spending old ones. */
  coinbase: boolean;
  confirmed: boolean;
  blockHeight: number | null;
  blockHash: string | null;
  blockTime: number | null;
  confirmations: number;
  vsize: number;
  weight: number;
  feeSats: number | null;
  /** sat/vB */
  feeRate: number | null;
  inputs: JourneyInput[];
  outputs: JourneyOutput[];
  totalInSats: number;
  totalOutSats: number;
}

const sats = (btc: number) => Math.round(btc * 1e8);

/**
 * Raw node data to a journey. `times` maps block heights to block times (for when each
 * input was created); `outspends` is optional and lines up with the outputs; `blockHeight`
 * is the confirming block's height (the node's transaction data doesn't carry it).
 */
export function buildJourney(raw: RawTx, times: Map<number, number>, outspends: RawOutspend[] | null, blockHeight: number | null): Journey {
  const coinbase = raw.vin.length > 0 && raw.vin.every((v) => v.coinbase != null);
  const confirmed = Boolean(raw.blockhash && raw.confirmations && raw.confirmations > 0);
  const blockTime = confirmed ? (raw.blocktime ?? null) : null;

  const inputs: JourneyInput[] = coinbase
    ? []
    : raw.vin.map((v, index) => {
        const p = v.prevout;
        const createdHeight = p && p.height > 0 ? p.height : null;
        const createdTime = createdHeight != null ? (times.get(createdHeight) ?? null) : null;
        // An awakening is measured at the moment of spending; for a waiting transaction, that's now.
        const spendTime = blockTime ?? Math.floor(Date.now() / 1000);
        return {
          index,
          prevTxid: v.txid ?? "",
          prevVout: v.vout ?? 0,
          valueSats: p ? sats(p.value) : 0,
          address: p?.scriptPubKey.address ?? null,
          scriptType: p?.scriptPubKey.type ?? null,
          createdHeight,
          createdTime,
          minerReward: Boolean(p?.generated),
          dormant: createdTime != null && spendTime - createdTime >= DORMANT_SECONDS,
        };
      });

  const inAddrs = new Set(inputs.map((i) => i.address).filter(Boolean));
  const outputs: JourneyOutput[] = raw.vout.map((o, i) => {
    const address = o.scriptPubKey.address ?? null;
    const os = outspends?.[i];
    return {
      index: o.n,
      valueSats: sats(o.value),
      address,
      scriptType: o.scriptPubKey.type ?? null,
      kind: o.scriptPubKey.type === "nulldata" ? "data" : address && inAddrs.has(address) ? "change" : "payment",
      next: !os ? null : os.spent && os.txid ? { spent: true, txid: os.txid, height: os.status?.block_height ?? null, time: os.status?.block_time ?? null } : { spent: false },
    };
  });

  const totalInSats = inputs.reduce((n, i) => n + i.valueSats, 0);
  const totalOutSats = outputs.reduce((n, o) => n + o.valueSats, 0);
  const feeSats = coinbase ? null : raw.fee != null ? sats(raw.fee) : totalInSats > 0 ? totalInSats - totalOutSats : null;

  return {
    txid: raw.txid,
    coinbase,
    confirmed,
    blockHeight: confirmed ? blockHeight : null,
    blockHash: confirmed ? raw.blockhash! : null,
    blockTime,
    confirmations: confirmed ? raw.confirmations! : 0,
    vsize: raw.vsize,
    weight: raw.weight,
    feeSats,
    feeRate: feeSats != null && raw.vsize > 0 ? feeSats / raw.vsize : null,
    inputs,
    outputs,
    totalInSats,
    totalOutSats,
  };
}

/** Plain-words age bucket for a coin, for grouping inputs. */
export function ageBucket(seconds: number): "hours" | "days" | "months" | "years" | "dormant" {
  if (seconds >= DORMANT_SECONDS) return "dormant";
  if (seconds >= 365 * 86400) return "years";
  if (seconds >= 30 * 86400) return "months";
  if (seconds >= 86400) return "days";
  return "hours";
}

/** How a fee compares with the typical (median) rate paid in the same block. */
export function feeVsTypical(rate: number, median: number): "well below" | "below" | "about" | "above" | "well above" {
  if (median <= 0) return "about";
  const r = rate / median;
  if (r < 0.5) return "well below";
  if (r < 0.85) return "below";
  if (r <= 1.25) return "about";
  if (r <= 3) return "above";
  return "well above";
}
