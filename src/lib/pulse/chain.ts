import { rpcFromEnv } from "@/lib/detector/rpc";
import type { PulseBlock } from "./types";

/**
 * Block data straight from a Bitcoin node (the same connection the detector uses), so the
 * terminal doesn't depend on a third-party API for it. Each block is read once and kept.
 */

// Pools write a tag into their coinbase transaction. Matched case-insensitively, first hit wins
// (more specific tags first). Best effort: an unknown tag is reported as no pool, never guessed.
const POOL_TAGS: [RegExp, string][] = [
  [/foundry usa/i, "Foundry USA"],
  [/antpool/i, "AntPool"],
  [/f2pool|七彩神仙鱼/i, "F2Pool"],
  [/viabtc/i, "ViaBTC"],
  [/mara (pool|made)|marapool/i, "MARA Pool"],
  [/spiderpool/i, "SpiderPool"],
  [/secpool/i, "SECPOOL"],
  [/luxor/i, "Luxor"],
  [/binance/i, "Binance Pool"],
  [/braiins|slush/i, "Braiins Pool"],
  [/poolin/i, "Poolin"],
  [/ocean\.xyz|ocean/i, "OCEAN"],
  [/sbicrypto|sbi crypto/i, "SBI Crypto"],
  [/btc\.com|btcom/i, "BTC.com"],
  [/whitepool/i, "WhitePool"],
  [/ultimus/i, "ULTIMUSPOOL"],
  [/emcd/i, "EMCDPool"],
  [/innopolis/i, "Innopolis Tech"],
  [/titan/i, "Titan"],
  [/bitfufu/i, "BitFuFu"],
  [/mining ?squared|bsquared/i, "Mining Squared"],
  [/1thash/i, "1THash"],
  [/kucoin/i, "KuCoinPool"],
  [/btc\.?top/i, "BTC.TOP"],
  [/cloverpool/i, "CloverPool"],
  [/sigmapool/i, "SigmaPool"],
  [/nicehash/i, "NiceHash"],
  [/rawpool/i, "Rawpool"],
  [/gdpool/i, "GDPool"],
  [/trustpool/i, "TrustPool"],
  [/solo\.ckpool/i, "Solo CK"],
];

export function poolFromCoinbase(hex: string): string | null {
  let text = "";
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const c = parseInt(hex.slice(i, i + 2), 16);
    text += c >= 32 && c < 127 ? String.fromCharCode(c) : " ";
  }
  try {
    text += " " + new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(hex.match(/../g)?.map((b) => parseInt(b, 16)) ?? []));
  } catch {
    /* ascii view is enough */
  }
  for (const [re, name] of POOL_TAGS) if (re.test(text)) return name;
  return null;
}

type Stats = {
  blockhash: string; height: number; time: number; txs: number; total_size: number; total_weight: number;
  totalfee: number; feerate_percentiles: number[]; subsidy: number; total_out: number;
};
const FIELDS = ["blockhash", "height", "time", "txs", "total_size", "total_weight", "totalfee", "feerate_percentiles", "subsidy", "total_out"];

const g = globalThis as unknown as { gwChain?: Map<number, PulseBlock>; gwChainTip?: { at: number; height: number } };
const blocks = (g.gwChain ??= new Map());

/** About a day of blocks (144) plus margin, for the 24-hour dial and "who's mining". */
export const WARM_BLOCKS = 170;

const chunk = <T,>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

async function load(heights: number[]) {
  const rpc = rpcFromEnv();
  for (const part of chunk(heights, 25)) {
    const stats = await rpc.batch<Stats>(part.map((h) => ["getblockstats", [h, FIELDS]]));
    // Pool: the coinbase transaction's tag. Two small calls per block (block → first txid → coinbase).
    const heads = await rpc.batch<{ tx: string[] }>(stats.map((s) => ["getblock", [s.blockhash, 1]]));
    const cbs = await rpc.batch<{ vin: { coinbase?: string }[] }>(heads.map((b, i) => ["getrawtransaction", [b.tx[0], 1, stats[i].blockhash]]));
    stats.forEach((s, i) => {
      blocks.set(s.height, {
        height: s.height,
        hash: s.blockhash,
        time: s.time,
        txCount: s.txs,
        size: s.total_size,
        weight: s.total_weight,
        totalFees: s.totalfee,
        // The node rounds rates down to whole sat/vB; below 1 it reads 0, so use the precise average then.
        medianFee: s.feerate_percentiles?.[2] || (s.total_weight ? s.totalfee / (s.total_weight / 4) : 0),
        reward: s.subsidy + s.totalfee,
        pool: cbs[i]?.vin?.[0]?.coinbase ? poolFromCoinbase(cbs[i].vin[0].coinbase!) : null,
        totalOutput: s.total_out,
      });
    });
  }
}

/** Current tip height, asked at most every 15 seconds. */
export async function tipHeight(): Promise<number> {
  if (g.gwChainTip && Date.now() - g.gwChainTip.at < 15_000) return g.gwChainTip.height;
  const height = await rpcFromEnv().call<number>("getblockcount");
  g.gwChainTip = { at: Date.now(), height };
  return height;
}

/**
 * The last `count` blocks, newest first, from the node. Only blocks not seen before are
 * fetched, so after the first call this is one small request per new block.
 */
export async function recentBlocks(count: number): Promise<PulseBlock[]> {
  const tip = await tipHeight();
  const want = Array.from({ length: count }, (_, i) => tip - i).filter((h) => h >= 0);
  const missing = want.filter((h) => !blocks.has(h));
  if (missing.length) await load(missing);
  for (const h of blocks.keys()) if (h < tip - 400) blocks.delete(h);
  return want.map((h) => blocks.get(h)).filter((b): b is PulseBlock => Boolean(b));
}

/**
 * Blocks already read, newest first, without waiting. Missing ones are loaded in the
 * background (the first warm-up reads ~150 blocks and takes a minute or two).
 */
export function recentBlocksNow(count: number): PulseBlock[] {
  const g2 = g as unknown as { gwChainLoading?: Promise<unknown> };
  if (!g2.gwChainLoading) {
    g2.gwChainLoading = recentBlocks(Math.max(count, WARM_BLOCKS))
      .catch(() => {})
      .finally(() => {
        g2.gwChainLoading = undefined;
      });
  }
  const tip = g.gwChainTip?.height ?? Math.max(0, ...blocks.keys());
  return Array.from({ length: count }, (_, i) => blocks.get(tip - i)).filter((b): b is PulseBlock => Boolean(b));
}

/** One block's stats by height or hash (for block pages), cached like the rest. */
export async function blockByHeight(height: number): Promise<PulseBlock | null> {
  if (!blocks.has(height)) await load([height]).catch(() => {});
  return blocks.get(height) ?? null;
}
