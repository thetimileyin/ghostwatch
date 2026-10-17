import { btcShort, durationLong, heightLabel, monthYear, satsToBtcString } from "./format";
import type { GhostEvent } from "./types";

// The Signal Guide separates what the chain proves from what people infer.
// Copy is generated only from stored event facts; nothing here guesses identity.

export interface SignalGuide {
  observed: string[];
  possible: string[];
  notProof: string[];
}

/**
 * "unspent for 6 years" when one output is involved; "unspent for up to 14 years"
 * when several are, since only the oldest slept that long.
 */
export function ageClause(e: GhostEvent): string {
  return `unspent for ${e.dormantInputCount > 1 ? "up to " : ""}${durationLong(e.oldestCreatedTime, e.blockTime)}`;
}

export function headline(e: GhostEvent): string {
  return `${btcShort(e.dormantSats)} ${ageClause(e)} just moved`;
}

export function summary(e: GhostEvent): string {
  const n = e.dormantInputCount;
  const outputs = n === 1 ? "One output" : `${n} outputs`;
  const extra = e.totalInputCount - n;
  const extraText = extra > 0 ? ` ${extra === 1 ? "One newer input" : `${extra} newer inputs`} in the same transaction ${extra === 1 ? "is" : "are"} not counted.` : "";
  const created = n === 1 ? `created in ${monthYear(e.oldestCreatedTime)}` : `the oldest created in ${monthYear(e.oldestCreatedTime)},`;
  return `${outputs}${n === 1 ? "" : ","} ${created} ${n === 1 ? "was" : "were"} spent in block ${heightLabel(e.blockHeight)}.${extraText}`;
}

export function signalGuide(e: GhostEvent): SignalGuide {
  const n = e.dormantInputCount;
  const observed = [
    n === 1
      ? `An output created in ${monthYear(e.oldestCreatedTime)} was spent in block ${heightLabel(e.blockHeight)}.`
      : `${n} outputs unspent for 5+ years were spent in block ${heightLabel(e.blockHeight)}. The oldest dates from ${monthYear(e.oldestCreatedTime)}.`,
    `${n === 1 ? "It" : "They"} held ${satsToBtcString(e.dormantSats)} BTC.`,
    `The transaction has ${e.totalInputCount} input${e.totalInputCount === 1 ? "" : "s"} and ${e.outputCount} output${e.outputCount === 1 ? "" : "s"}.`,
  ];
  if (e.status === "reversed") observed.push("The block containing it was later replaced. It is no longer confirmed.");

  const possible = [
    "The holder moved coins to a new wallet or address type.",
    n > 1 ? "Old coins were consolidated into fewer outputs." : "The coins were sent to someone else.",
    "Coins were prepared for sale or custody. This can't be seen on-chain.",
  ];

  const notProof = [
    "A sale. A transfer is not a trade.",
    "A hack or theft.",
    "Who owns these coins.",
  ];
  if (e.oldestCreatedTime < 1_325_376_000) notProof.push("That they belong to Satoshi. Early coins had many owners.");

  return { observed, possible, notProof };
}
