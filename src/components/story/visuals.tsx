import type { GhostInput } from "@/lib/domain/types";
import { heightLabel, satsToBtcString } from "@/lib/domain/format";

export const HALVING_INTERVAL = 210_000;

/** Block subsidy in BTC at a height: 50, halved every 210,000 blocks. */
export const subsidyAt = (height: number) => 50 / 2 ** Math.floor(height / HALVING_INTERVAL);

/** Halving heights strictly after `from` and at or before `to`. */
export function halvingsBetween(from: number, to: number): number[] {
  const out: number[] = [];
  for (let h = (Math.floor(from / HALVING_INTERVAL) + 1) * HALVING_INTERVAL; h <= to; h += HALVING_INTERVAL) out.push(h);
  return out;
}

// Approximate year of each halving, for labels only (heights are exact).
const HALVING_YEAR: Record<number, number> = { 210000: 2012, 420000: 2016, 630000: 2020, 840000: 2024, 1050000: 2028 };

/**
 * The sleep as a field of squares: one square per `step` blocks between creation and
 * spending. Squares where a halving happened are orange and labelled.
 */
export function SleepField({ from, to }: { from: number; to: number }) {
  const span = Math.max(1, to - from);
  const step = span > 300_000 ? 1000 : span > 60_000 ? 250 : 50;
  const count = Math.ceil(span / step);
  const cols = 48;
  const rows = Math.ceil(count / cols);
  const cell = 10;
  const halvings = new Set(halvingsBetween(from, to).map((h) => Math.floor((h - from) / step)));
  const W = cols * cell;
  const H = rows * cell;
  return (
    <figure className="st-field" aria-label={`${span.toLocaleString("en-US")} blocks passed while the coins slept. Each square is ${step.toLocaleString("en-US")} blocks.`}>
      <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => {
          const x = (i % cols) * cell;
          const y = Math.floor(i / cols) * cell;
          const hot = halvings.has(i);
          return <rect key={i} x={x + 1.5} y={y + 1.5} width={cell - 3} height={cell - 3} className={hot ? "st-sq st-sq--hot" : "st-sq"} />;
        })}
      </svg>
      <figcaption className="st-cap">
        <span>Block {heightLabel(from)}</span>
        <span>Each square is {step.toLocaleString("en-US")} blocks{halvings.size ? " · orange: a halving" : ""}</span>
        <span>Block {heightLabel(to)}</span>
      </figcaption>
      {halvings.size > 0 && (
        <ul className="st-halvings">
          {halvingsBetween(from, to).map((h) => (
            <li key={h}><i aria-hidden="true" /> Halving at block {heightLabel(h)}{HALVING_YEAR[h] ? ` (${HALVING_YEAR[h]})` : ""}: reward fell to {subsidyAt(h)} BTC</li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/**
 * The waking transaction: every input as a square (orange when it had slept five years
 * or more), flowing into the transaction and out to its outputs.
 */
export function WakeFlow({ inputs, outputCount }: { inputs: GhostInput[]; outputCount: number }) {
  const sorted = [...inputs].sort((a, b) => a.createdHeight - b.createdHeight);
  // Large transactions: an even sample across all inputs, so old and new keep their proportions.
  const MAX = 28;
  const shown = sorted.length <= MAX ? sorted : Array.from({ length: MAX }, (_, i) => sorted[Math.floor((i * sorted.length) / MAX)]);
  const sampled = sorted.length > MAX;
  const outs = Math.min(outputCount, 12);
  const colH = Math.max(shown.length, outs) * 14;
  const H = Math.max(120, colH + 20);
  const tx = { x: 250, y: H / 2 - 40, w: 100, h: 80 };
  return (
    <figure className="st-flow" aria-label={`${inputs.length} inputs went into one transaction with ${outputCount} outputs.`}>
      <svg viewBox={`0 0 600 ${H}`} aria-hidden="true">
        {shown.map((inp, i) => {
          const y = H / 2 - (shown.length * 14) / 2 + i * 14 + 7;
          return (
            <g key={inp.inputIndex} className={inp.qualifies ? "st-in st-in--old" : "st-in"}>
              <rect x={40} y={y - 5} width={10} height={10} />
              <path d={`M 52 ${y} C 160 ${y}, 170 ${H / 2}, ${tx.x} ${H / 2}`} />
            </g>
          );
        })}
        <rect className="st-tx" x={tx.x} y={tx.y} width={tx.w} height={tx.h} />
        <text className="st-tx-l" x={tx.x + tx.w / 2} y={H / 2 + 4} textAnchor="middle">TX</text>
        {Array.from({ length: outs }, (_, i) => {
          const y = H / 2 - (outs * 14) / 2 + i * 14 + 7;
          return (
            <g key={i} className="st-out">
              <path d={`M ${tx.x + tx.w} ${H / 2} C 430 ${H / 2}, 440 ${y}, 548 ${y}`} />
              <rect x={550} y={y - 5} width={10} height={10} />
            </g>
          );
        })}
      </svg>
      <figcaption className="st-cap">
        <span>{inputs.length} input{inputs.length === 1 ? "" : "s"}{sampled ? ` (${shown.length} shown, evenly sampled)` : ""} · orange: unspent 5+ years</span>
        <span>{outputCount} output{outputCount === 1 ? "" : "s"}</span>
      </figcaption>
    </figure>
  );
}

const LOCK_TAG: Record<string, string> = {
  pubkey: "P2PK",
  pubkeyhash: "P2PKH",
  scripthash: "P2SH",
  witness_v0_keyhash: "SEGWIT",
  witness_v0_scripthash: "SEGWIT",
  witness_v1_taproot: "TAPROOT",
  multisig: "MULTISIG",
};

/**
 * The block the coins were created in, drawn from its real numbers: it fills to how
 * full the block was, holds one square per transaction (sampled when busy), and the
 * coin's transaction is the orange one. The tag on top is how the coin was locked.
 * Falls back to an empty outline when the block can't be looked up.
 */
export function BlockGlyph({ height, value, txCount, fullness, scriptType }: { height: number; value: number; txCount: number | null; fullness: number | null; scriptType: string | null }) {
  // Front face: x 40..160, y 40..140. Fill rises from the bottom; a sliver always shows so empty-ish blocks still read.
  const fill = fullness == null ? 0 : Math.max(0.06, fullness);
  const fillTop = 140 - 100 * fill;
  const n = txCount ?? 0;
  const per = n > 160 ? Math.ceil(n / 160) : 1;
  const squares = Math.ceil(n / per);
  const cols = 16;
  const cell = 120 / cols;
  const rows = Math.ceil(squares / cols);
  const gridH = rows * cell;
  // Squares sit inside the filled part, from the bottom up; if there are more rows than fill, they show above it too.
  const coinIndex = Math.min(squares - 1, Math.max(0, Math.floor(squares / 2)));
  const tag = scriptType ? LOCK_TAG[scriptType] : null;
  return (
    <figure className="st-block" aria-label={`Block ${height}${txCount != null ? `, ${txCount} transactions, ${Math.round((fullness ?? 0) * 100)}% full` : ""}`}>
      <svg viewBox="0 0 220 150" aria-hidden="true">
        <path className="st-cube-top" d="M40 40 L70 18 L190 18 L160 40 Z" />
        <path className="st-cube-side" d="M160 40 L190 18 L190 118 L160 140 Z" />
        <rect className="st-cube-front" x="40" y="40" width="120" height="100" />
        {fullness != null && <rect className="st-cube-fill" x="40" y={fillTop} width="120" height={140 - fillTop} />}
        {Array.from({ length: squares }, (_, i) => {
          const x = 40 + (i % cols) * cell;
          const y = 140 - gridH + Math.floor(i / cols) * cell;
          const coin = i === coinIndex;
          return <rect key={i} x={x + 1.2} y={Math.max(41, y) + 1.2} width={cell - 2.4} height={cell - 2.4} className={coin ? "st-tx-sq st-tx-sq--coin" : "st-tx-sq"} />;
        })}
        {txCount == null && <rect className="st-coin" x="88" y="78" width="24" height="24" />}
        {tag && (
          <g className="st-lock-tag">
            <rect x="80" y="23" width={tag.length * 6.6 + 12} height="13" />
            <text x={86} y="33">{tag}</text>
          </g>
        )}
      </svg>
      <figcaption className="st-cap st-cap--center">
        <span>Block {heightLabel(height)}</span>
        {txCount != null && <span>{txCount.toLocaleString("en-US")} transaction{txCount === 1 ? "" : "s"}{per > 1 ? ` · each square ${per}` : ""} · orange: this coin</span>}
        {fullness != null && <span>{fullness < 0.01 ? "under 1%" : `${Math.round(fullness * 100)}%`} full</span>}
        <span>{satsToBtcString(value)} BTC created</span>
      </figcaption>
    </figure>
  );
}
