import Link from "next/link";
import { dateShort, monthYear, splitBtc } from "@/lib/domain/format";
import { ageClause } from "@/lib/domain/signal";
import type { GhostEvent } from "@/lib/domain/types";
import { ArchivePill, CohortTag, SleepTrack, StatusPill } from "./event-bits";
import { ArrowRightIcon } from "./icons";

/** The most notable event in a list: oldest cohort first, then the largest amount. */
export function pickSpotlight(events: GhostEvent[]): GhostEvent | null {
  const confirmed = events.filter((e) => e.status === "confirmed");
  if (confirmed.length === 0) return null;
  return confirmed.reduce((best, e) => (e.cohort > best.cohort || (e.cohort === best.cohort && e.dormantSats > best.dormantSats) ? e : best));
}

/**
 * The page's one layered moment: a glow field coloured by the coin's age, with
 * the event floating in it as type and light. No card around it.
 */
export function Spotlight({ e, now, label }: { e: GhostEvent; now: number; label: string }) {
  const { head, tail } = splitBtc(e.dormantSats);
  return (
    <section className="stage" data-age={e.cohort} data-tone={e.origin === "archive" ? "arch" : undefined} aria-label={label}>
      <Link href={`/e/${e.id}`} className="figure" data-age={e.cohort}>
        <div className="kicker">
          <span>{label}</span>
          <CohortTag cohort={e.cohort} />
          {e.origin === "archive" ? <ArchivePill /> : <StatusPill status={e.status} height={e.blockHeight} />}
        </div>
        <div className="big num">
          {head}
          <span className="lo">{tail}</span>
          <span className="u">BTC</span>
        </div>
        <div className="line">
          {ageClause(e)}, <span className="dim">then moved.</span>
        </div>
        <SleepTrack e={e} now={now} />
        <div className="ends">
          <span>Created {monthYear(e.oldestCreatedTime)}</span>
          <span>Spent {dateShort(e.blockTime)}</span>
        </div>
        <div className="open">
          <span className="link-arrow">
            Open the evidence <ArrowRightIcon aria-hidden />
          </span>
        </div>
      </Link>
    </section>
  );
}
