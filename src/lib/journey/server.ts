import { getEvent } from "@/lib/db/read";
import { eventIdForTxid } from "@/lib/detector/detect";
import { rpcFromEnv } from "@/lib/detector/rpc";
import { MEMPOOL, cached, chunks, getJson } from "./fetch";
import { buildJourney, isTxid, type Journey, type RawOutspend, type RawTx } from "./journey";


export interface BlockInfo {
  txCount: number;
  /** 0 to 1 of the 4,000,000 weight-unit limit. */
  fullness: number;
  pool: string | null;
  /** Typical (median) fee rate paid in the block, sat/vB. */
  medianFee: number | null;
}

export type JourneyResult =
  | { kind: "ok"; journey: Journey; block: BlockInfo | null; eventId: string | null; firstSeen: number | null; tip: number | null }
  | { kind: "not-found" }
  | { kind: "block"; hash: string }
  | { kind: "invalid" }
  | { kind: "error" };

// mempool.space script names to Bitcoin Core's, so the page speaks one vocabulary.
const CORE_TYPE: Record<string, string> = {
  p2pk: "pubkey",
  p2pkh: "pubkeyhash",
  p2sh: "scripthash",
  v0_p2wpkh: "witness_v0_keyhash",
  v0_p2wsh: "witness_v0_scripthash",
  v1_p2tr: "witness_v1_taproot",
  multisig: "multisig",
  op_return: "nulldata",
};

const MAX_WAITING_PARENTS = 25;

async function fillWaiting(raw: RawTx) {
  type MTx = { fee: number; vin: { txid: string; is_coinbase: boolean; prevout: { value: number; scriptpubkey_type: string; scriptpubkey_address?: string } | null }[] };
  const m = await getJson<MTx>(`${MEMPOOL}/tx/${raw.txid}`);
  if (!m) return;
  const parents = [...new Set(m.vin.map((v) => v.txid))].slice(0, MAX_WAITING_PARENTS);
  const status = new Map<string, { confirmed: boolean; block_height?: number }>();
  await Promise.all(
    parents.map(async (p) => {
      const s = await getJson<{ confirmed: boolean; block_height?: number }>(`${MEMPOOL}/tx/${p}/status`);
      if (s) status.set(p, s);
    }),
  );
  raw.fee = m.fee / 1e8;
  raw.vin = raw.vin.map((v, i) => {
    const mv = m.vin[i];
    if (v.prevout || !mv?.prevout) return v;
    const s = status.get(mv.txid);
    return {
      ...v,
      prevout: {
        generated: false,
        height: s?.confirmed && s.block_height ? s.block_height : -1,
        value: mv.prevout.value / 1e8,
        scriptPubKey: { type: CORE_TYPE[mv.prevout.scriptpubkey_type] ?? mv.prevout.scriptpubkey_type, address: mv.prevout.scriptpubkey_address },
      },
    };
  });
}


/**
 * Everything the journey page needs for one transaction. Fetched by our server, so the
 * visitor's browser never contacts the node or mempool.space, and nothing is logged.
 * Confirmed transactions are cached for 10 minutes, waiting ones for 20 seconds.
 */
export async function getJourney(input: string): Promise<JourneyResult> {
  const txid = input.trim().toLowerCase();
  if (!isTxid(txid)) return { kind: "invalid" };
  return cached(`tx:${txid}`, () => load(txid), (v) =>
    v.kind === "ok" ? (v.journey.confirmed ? 10 * 60_000 : 20_000) : v.kind === "not-found" || v.kind === "block" ? 10 * 60_000 : 0,
  );
}

async function load(txid: string): Promise<JourneyResult> {
  const rpc = rpcFromEnv();
  let raw: RawTx;
  try {
    raw = await rpc.call<RawTx>("getrawtransaction", [txid, 2]);
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    if (!/no such|not found/i.test(msg)) return { kind: "error" };
    // 64 hex characters can also be a block hash.
    const isBlock = await rpc.call("getblockheader", [txid]).then(() => true, () => false);
    return isBlock ? { kind: "block", hash: txid } : { kind: "not-found" };
  }

  try {
    // A transaction still waiting: the node doesn't attach the coins it spends, so take them
    // (and the fee) from mempool.space, with each parent's block from its status.
    if (!raw.blockhash && raw.vin.some((v) => !v.prevout)) await fillWaiting(raw);

    // When each input's coin was created: block heights to block times, two batched calls.
    const heights = [...new Set(raw.vin.map((v) => v.prevout?.height).filter((h): h is number => typeof h === "number" && h > 0))];
    const times = new Map<number, number>();
    for (const part of chunks(heights, 250)) {
      const hashes = await rpc.batch<string>(part.map((h) => ["getblockhash", [h]]));
      const headers = await rpc.batch<{ time: number }>(hashes.map((h) => ["getblockheader", [h]]));
      part.forEach((h, i) => times.set(h, headers[i].time));
    }

    const confirmed = Boolean(raw.blockhash && raw.confirmations);
    const [header, outspends, blockRaw, seen, tip, event] = await Promise.all([
      confirmed ? rpc.call<{ height: number }>("getblockheader", [raw.blockhash]).catch(() => null) : null,
      getJson<RawOutspend[]>(`${MEMPOOL}/tx/${txid}/outspends`),
      confirmed ? getJson<{ tx_count: number; weight: number; extras?: { pool?: { name?: string }; medianFee?: number } }>(`${MEMPOOL}/v1/block/${raw.blockhash}`) : null,
      confirmed ? null : getJson<number[]>(`${MEMPOOL}/v1/transaction-times?txId[]=${txid}`),
      rpc.call<number>("getblockcount").catch(() => null),
      getEvent(eventIdForTxid(txid)).catch(() => null),
    ]);

    const journey = buildJourney(raw, times, outspends, header?.height ?? null);
    const block: BlockInfo | null = blockRaw
      ? {
          txCount: blockRaw.tx_count,
          fullness: Math.min(1, blockRaw.weight / 4_000_000),
          pool: blockRaw.extras?.pool?.name ?? null,
          medianFee: blockRaw.extras?.medianFee ?? null,
        }
      : null;
    return {
      kind: "ok",
      journey,
      block,
      eventId: event && event.txid === txid ? event.id : null,
      firstSeen: seen?.[0] && seen[0] > 0 ? seen[0] : null,
      tip,
    };
  } catch {
    return { kind: "error" };
  }
}
