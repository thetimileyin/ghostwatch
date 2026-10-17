import { dateShort, splitBtc } from "@/lib/domain/format";
import { GENESIS_TIME } from "@/lib/domain/time";
import type { Cohort, EventStatus, GhostEvent } from "@/lib/domain/types";
import { CheckIcon, HistoryIcon, WarningIcon } from "./icons";

/** Full-precision amount: significant head bright, trailing decimals dim. */
export function BtcAmount({ sats, className = "amt" }: { sats: number; className?: string }) {
  const { head, tail } = splitBtc(sats);
  return (
    <span className={`${className} num`}>
      {head}
      <span className="lo">{tail}</span>
      <span className="u">BTC</span>
    </span>
  );
}

export function CohortTag({ cohort, suffix = "" }: { cohort: Cohort; suffix?: string }) {
  return (
    <span className="cohort" data-age={cohort} title={`Unspent for at least ${cohort} years`}>
      {cohort}Y+{suffix}
    </span>
  );
}

export function StatusPill({ status, height }: { status: EventStatus; height: number }) {
  if (status === "reversed")
    return (
      <span className="pill pill--bad">
        <WarningIcon aria-hidden />
        Reversed
      </span>
    );
  return (
    <span className="pill pill--ok">
      <CheckIcon aria-hidden />
      Confirmed<span className="pill-height"> · {height.toLocaleString("en-US")}</span>
    </span>
  );
}

export function ArchivePill() {
  return (
    <span className="pill pill--arch" title="A past awakening found by backfilling old blocks with the same detector">
      <HistoryIcon aria-hidden />
      Archive
    </span>
  );
}

/** Concentric rings: one per cohort step, so age reads without colour too. */
export function CohortGlyph({ cohort }: { cohort: Cohort }) {
  return (
    <svg className="glyph" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="3.5" fill="currentColor" />
      {cohort >= 10 && <circle cx="11" cy="11" r="7" stroke="currentColor" strokeOpacity=".45" />}
      {cohort >= 15 && <circle cx="11" cy="11" r="10.25" stroke="currentColor" strokeOpacity=".22" />}
      {cohort === 5 && <circle cx="11" cy="11" r="7" stroke="currentColor" strokeOpacity=".22" strokeDasharray="2 3" />}
    </svg>
  );
}

/** Position on the 2009-to-now axis, as a percentage. */
export function axisPct(unix: number, now: number): number {
  return Math.max(0, Math.min(100, ((unix - GENESIS_TIME) / (now - GENESIS_TIME)) * 100));
}

const tickYears = [2009, 2013, 2017, 2021];

export function SleepTrack({ e, now }: { e: GhostEvent; now: number }) {
  const left = axisPct(e.oldestCreatedTime, now);
  const right = 100 - axisPct(e.blockTime, now);
  return (
    <div className="sleep" role="img" aria-label={`Unspent from ${dateShort(e.oldestCreatedTime)} to ${dateShort(e.blockTime)}`}>
      <div className="track">
        <span className="seg-lit" style={{ left: `${left}%`, right: `${right}%` }} />
      </div>
      <div className="ticks" aria-hidden="true">
        {tickYears.map((y) => (
          <span key={y} style={{ left: `${y === 2009 ? 0 : axisPct(Date.UTC(y, 0, 1) / 1000, now)}%` }}>
            {y}
          </span>
        ))}
        <span style={{ left: "100%" }}>now</span>
      </div>
    </div>
  );
}
