"use client";

import Link from "next/link";
import { usd } from "@/lib/pulse/format";
import type { Pulse, PulseBlock } from "@/lib/pulse/types";
import type { View } from "../lab/view";
import { ArrowRightIcon, CaretDownIcon, CaretUpIcon, GhostIcon } from "../icons";
import { MobileMenu } from "../mobile-menu";
import { ThemeSwitch } from "../theme-switch";
import { Wordmark } from "../wordmark";

export type Area = "terminal" | "feed" | "archive";

function tone(median: number) {
  if (median >= 20) return "hot";
  if (median >= 5) return "busy";
  if (median >= 2) return "warm";
  return "calm";
}

/** Plain-language state of the chain, shown next to the block clock. */
export function chainWeather(p: Pulse | null, nowMs: number): { label: string; tone: "clear" | "busy" | "hot" | "slow" | "ghost" } {
  if (!p) return { label: "Connecting", tone: "clear" };
  if (p.ghosts.some((g) => nowMs / 1000 - g.blockTime < 3600 && g.cohort >= 10)) return { label: "Old coins awake", tone: "ghost" };
  if ((p.fees?.fastest ?? 0) >= 20) return { label: "Expensive", tone: "hot" };
  if ((p.mempool?.count ?? 0) > 150_000) return { label: "Busy", tone: "busy" };
  const tip = p.blocks[0];
  if (tip && nowMs / 1000 - tip.time > 1500) return { label: "Slow block", tone: "slow" };
  return { label: "Clear", tone: "clear" };
}

/**
 * The timechain strip: the latest blocks as small blocks, filled by how full they
 * were and lit by fees, ending in the next block, filling up as time passes.
 */
function Timechain({ blocks, nowMs, landed }: { blocks: PulseBlock[]; nowMs: number; landed: number | null }) {
  const recent = blocks.slice(0, 10).reverse();
  const tip = blocks[0];
  const since = tip ? Math.max(0, nowMs / 1000 - tip.time) : 0;
  return (
    <ol className="tc" aria-label="Latest blocks">
      {recent.map((b) => (
        <li
          key={b.height}
          className={`tc-b tc-b--${tone(b.medianFee)}${landed === b.height ? " tc-b--new" : ""}`}
          style={{ ["--f" as string]: Math.min(1, b.weight / 4_000_000) }}
          title={`Block ${b.height.toLocaleString("en-US")} · ${b.txCount.toLocaleString("en-US")} tx · ${b.pool ?? "unknown pool"}`}
        >
          <i aria-hidden="true" />
          <span className="sr-only">Block {b.height}</span>
        </li>
      ))}
      <li className="tc-b tc-b--next" style={{ ["--f" as string]: Math.min(1, since / 600) }} title="Next block, filling as time passes (10-minute average)">
        <i aria-hidden="true" />
        <span className="sr-only">Next block</span>
      </li>
    </ol>
  );
}

export function ChainBar({
  pulse,
  nowMs,
  view,
  choose,
  area,
  onGuide,
  landed = null,
}: {
  pulse: Pulse | null;
  nowMs: number;
  view: View;
  choose: (v: View) => void;
  area: Area;
  onGuide?: () => void;
  landed?: number | null;
}) {
  const tip = pulse?.blocks[0];
  const since = tip ? Math.max(0, nowMs / 1000 - tip.time) : null;
  const change = pulse?.priceUsd && pulse.network.price24hAgo ? (pulse.priceUsd - pulse.network.price24hAgo) / pulse.network.price24hAgo : null;
  const w = chainWeather(pulse, nowMs);
  const woke = (pulse?.ghosts ?? []).filter((g) => nowMs / 1000 - g.blockTime < 86400).length;
  const utc = new Date(nowMs).toISOString().slice(11, 19);
  return (
    <header className="cb">
      <div className="cb-l">
        <Link href="/" className="cb-brand" aria-label="GhostWatch home">
          <Wordmark size={20} />
          <span>
            Ghost<em>Watch</em>
          </span>
        </Link>
        <nav className="cb-nav" aria-label="Sections">
          <Link href="/terminal" aria-current={area === "terminal" ? "page" : undefined}>Terminal</Link>
          <Link href="/feed" aria-current={area === "feed" ? "page" : undefined}>Ghost feed</Link>
          <Link href="/archive" aria-current={area === "archive" ? "page" : undefined}>Archive</Link>
        </nav>
      </div>

      <div className="cb-c">
        <div className="cb-clock" aria-label="Latest block">
          <span className="cb-height num">{tip ? tip.height.toLocaleString("en-US") : "———"}</span>
          <span className="cb-since num">{since != null ? `+${Math.floor(since / 60)}:${String(Math.floor(since % 60)).padStart(2, "0")}` : ""}</span>
        </div>
        <Timechain blocks={pulse?.blocks ?? []} nowMs={nowMs} landed={landed} />
        <span className={`cb-weather cb-weather--${w.tone}`} title="Chain weather: a plain summary of fees, queue and block timing">
          <span className="cb-weather-dot" aria-hidden="true" />
          {w.label}
        </span>
        <span className="cb-price">
          <span className="num">{usd(pulse?.priceUsd ?? null)}</span>
          {change != null && <em className={change >= 0 ? "up" : "down"}>{change >= 0 ? <CaretUpIcon aria-hidden /> : <CaretDownIcon aria-hidden />}{change >= 0 ? "+" : "−"}{Math.abs(change * 100).toFixed(2)}%</em>}
        </span>
        {pulse && <span className="cb-utc num" title="Block times are in UTC">{utc} UTC</span>}
      </div>

      <div className="cb-r">
        <div className="seg" role="radiogroup" aria-label="Level of detail">
          {(["simple", "technical"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => choose(v)}>
              {v === "simple" ? "Simple" : "Technical"}
            </button>
          ))}
        </div>
        {onGuide && (
          <button type="button" className="cb-guide" onClick={onGuide}>
            Field guide
          </button>
        )}
        <Link href="/feed" className={`cb-alert${woke ? " is-on" : ""}`} title="Coins unspent for 5+ years that moved in the last 24 hours" aria-label={`Old coins moved in the last 24 hours: ${woke}`}>
          <GhostIcon className="cb-alert-i" aria-hidden />
          <span className="cb-alert-l">Old coins ·</span> <b className="num">{woke}</b>
        </Link>
        <ThemeSwitch />
      </div>

      <MobileMenu className="cb-mm">
        <nav className="mm-links" aria-label="Sections">
          <Link href="/terminal" aria-current={area === "terminal" ? "page" : undefined}>Terminal <ArrowRightIcon aria-hidden /></Link>
          <Link href="/feed" aria-current={area === "feed" ? "page" : undefined}>Ghost feed <ArrowRightIcon aria-hidden /></Link>
          <Link href="/archive" aria-current={area === "archive" ? "page" : undefined}>Archive <ArrowRightIcon aria-hidden /></Link>
          <Link href="/about">How it works <ArrowRightIcon aria-hidden /></Link>
        </nav>
        <div className="mm-row">
          <div className="seg" role="radiogroup" aria-label="Level of detail">
            {(["simple", "technical"] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => choose(v)}>
                {v === "simple" ? "Simple" : "Technical"}
              </button>
            ))}
          </div>
        </div>
        {onGuide && (
          <button type="button" className="cb-guide mm-wide" onClick={onGuide}>
            Field guide
          </button>
        )}
      </MobileMenu>
    </header>
  );
}
