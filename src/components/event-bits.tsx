import { dateShort } from "@/lib/domain/format";
import { GENESIS_TIME } from "@/lib/domain/time";
import type { GhostEvent } from "@/lib/domain/types";

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
