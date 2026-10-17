import { ago, heightLabel } from "@/lib/domain/format";
import type { FeedState, FeedStatus } from "@/lib/domain/types";

const LABEL: Record<FeedState, string> = { live: "Watching", delayed: "Delayed", stopped: "Stopped", unknown: "Starting" };
const DOT: Record<FeedState, string> = { live: "dot--live", delayed: "dot--wait", stopped: "dot--bad", unknown: "dot--off" };
const TONE: Record<FeedState, string> = { live: "", delayed: " st-state--wait", stopped: " st-state--bad", unknown: "" };

/** The instrument's status as one line of text: state, last block, check-in age. */
export function StatusChips({ status, state, hbAge }: { status: FeedStatus; state: FeedState; hbAge: number | null }) {
  return (
    <div className="status-line" role="status" aria-label="Detector status">
      <span className={`st-state${TONE[state]}`}>
        <span className={`dot ${DOT[state]}`} aria-hidden="true" />
        {LABEL[state]}
      </span>
      {status.lastProcessedHeight != null && (
        <>
          <span className="sep" aria-hidden="true">·</span>
          <span>
            Block <b className="num">{heightLabel(status.lastProcessedHeight)}</b>
          </span>
        </>
      )}
      {hbAge != null && (
        <span className="hide-md">
          <span className="sep" aria-hidden="true">· </span>
          checked {ago(hbAge)}
        </span>
      )}
    </div>
  );
}
