import Link from "next/link";
import { durationShort, monthYear } from "@/lib/domain/format";
import type { GhostEvent } from "@/lib/domain/types";
import { ArchivePill, BtcAmount, CohortGlyph, CohortTag, SleepTrack, StatusPill } from "./event-bits";
import { ArrowRightIcon } from "./icons";

export function FeedRow({ e, now, arrive = false }: { e: GhostEvent; now: number; arrive?: boolean }) {
  const reversed = e.status === "reversed";
  return (
    <li>
      <Link
        href={`/e/${e.id}`}
        className={`row${arrive ? " arrive" : ""}`}
        data-age={e.cohort}
        data-status={e.status}
        aria-label={`${(e.dormantSats / 1e8).toLocaleString("en-US", { maximumFractionDigits: 8 })} BTC unspent since ${monthYear(e.oldestCreatedTime)} moved in block ${e.blockHeight.toLocaleString("en-US")}${reversed ? ", reversed" : ""}${e.origin === "archive" ? ", archive" : ""}`}
      >
        <CohortGlyph cohort={e.cohort} />
        <div className="head">
          <BtcAmount sats={e.dormantSats} />
          <div className="what">
            Unspent since {monthYear(e.oldestCreatedTime)}
            {e.dormantInputCount > 1 ? ` · ${e.dormantInputCount} old outputs` : ""}
          </div>
        </div>
        <SleepTrack e={e} now={now} />
        <div className="meta">
          <span className="flex items-center gap-2">
            <CohortTag cohort={e.cohort} />
            <span>
              slept <span className="age">{durationShort(e.oldestCreatedTime, e.blockTime)}</span>
            </span>
          </span>
          {e.origin === "archive" ? (
            <span className="flex items-center gap-2">
              <ArchivePill />
              <span>{e.blockHeight.toLocaleString("en-US")}</span>
            </span>
          ) : (
            <StatusPill status={e.status} height={e.blockHeight} />
          )}
        </div>
        <ArrowRightIcon className="chev" aria-hidden />
      </Link>
    </li>
  );
}
