"use client";

import Link from "next/link";
import { durationShort, monthYear } from "@/lib/domain/format";
import { CLASS_COPY } from "@/lib/pulse/interest";
import { btc, satvb, short, sinceShort, usd } from "@/lib/pulse/format";
import type { LiveEvent } from "@/lib/pulse/use-pulse";
import { useView } from "./shell";

const EXPLORER = "https://mempool.space";

/** One line per event. Simple mode says what happened; Technical adds the numbers. */
export function EventLog({ events, now, price, limit = 14 }: { events: LiveEvent[]; now: number; price: number | null; limit?: number }) {
  const view = useView();
  if (events.length === 0) return <p className="lab-quiet">Listening to the network…</p>;
  return (
    <ol className="lab-log" aria-live="polite" aria-label="Live events">
      {events.slice(0, limit).map((e) => (
        <li key={e.key} className={`lab-ev lab-ev--${e.kind === "tx" ? e.cls : e.kind}${e.fresh ? " is-fresh" : ""}`}>
          <span className="lab-ev-time">{sinceShort(e.at / 1000, now)}</span>
          <span className="lab-ev-mark" aria-hidden="true" />
          <span className="lab-ev-body">{line(e, view, price)}</span>
        </li>
      ))}
    </ol>
  );
}

function line(e: LiveEvent, view: "simple" | "technical", price: number | null) {
  if (e.kind === "ghost") {
    const g = e.ghost;
    return (
      <Link href={`/e/${g.id}`}>
        <b>Coins from {monthYear(g.oldestCreatedTime)} woke up</b>
        <span className="lab-ev-sub">
          {btc(g.dormantSats)} unspent for {durationShort(g.oldestCreatedTime, g.blockTime).replace(/ \d+d$/, "")}
          {view === "technical" ? ` · ${g.dormantInputCount} input${g.dormantInputCount === 1 ? "" : "s"} · block ${g.blockHeight.toLocaleString("en-US")}` : ""}
        </span>
      </Link>
    );
  }
  if (e.kind === "block") {
    const b = e.block;
    return (
      <a href={`${EXPLORER}/block/${b.hash}`} target="_blank" rel="noopener noreferrer">
        <b>{view === "simple" ? `A new block was added${b.pool ? ` by ${b.pool}` : ""}` : `Block ${b.height.toLocaleString("en-US")} mined${b.pool ? ` · ${b.pool}` : ""}`}</b>
        <span className="lab-ev-sub">
          {view === "simple"
            ? `${b.txCount.toLocaleString("en-US")} transactions confirmed`
            : `${b.txCount.toLocaleString("en-US")} tx · ${(b.size / 1e6).toFixed(2)} MB · fees ${btc(b.totalFees)} · median ${satvb(b.medianFee)}`}
        </span>
      </a>
    );
  }
  const t = e.tx;
  const value = price ? ` (${usd((t.value / 1e8) * price)})` : "";
  return (
    <a href={`${EXPLORER}/tx/${t.txid}`} target="_blank" rel="noopener noreferrer">
      <b>{view === "simple" ? CLASS_COPY[e.cls].simple : `${CLASS_COPY[e.cls].tag} · ${short(t.txid)}`}</b>
      <span className="lab-ev-sub">
        {view === "simple"
          ? `${btc(t.value)}${value}`
          : `outputs ${btc(t.value)} · fee ${t.fee.toLocaleString("en-US")} sats · ${satvb(t.feeRate)} · ${t.vsize} vB`}
      </span>
    </a>
  );
}
