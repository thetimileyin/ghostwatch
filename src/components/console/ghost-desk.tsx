"use client";

import Link from "next/link";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";
import { useEffect, useMemo, useRef, useState } from "react";
import { SleepTrack } from "@/components/event-bits";
import { ArrowRightIcon, CloseIcon, RssIcon } from "@/components/icons";
import { dateShort, dateTimeUtc, durationShort, monthYear, satsToBtcString, splitBtc } from "@/lib/domain/format";
import { AGE_OPTIONS, MIN_OPTIONS, feedQueryString, type FeedQuery } from "@/lib/domain/filters";
import { ageClause, signalGuide, summary } from "@/lib/domain/signal";
import type { FeedPayload, FeedStats, GhostEvent } from "@/lib/domain/types";
import { btc, short } from "@/lib/pulse/format";
import { usePulse, useNow } from "@/lib/pulse/use-pulse";
import { ViewCtx, useView, useViewPreference } from "./view";
import { ChainBar } from "./chain-bar";
import { Panel, useLanded } from "./console";

type Mode = "feed" | "archive";

/**
 * Ghost feed and archive in the terminal frame: filters and context on the left,
 * the list in the centre, a live preview of the selected event on the right.
 */
export function GhostDesk({ mode }: { mode: Mode }) {
  const live = usePulse();
  const [view, choose] = useViewPreference();
  const now = useNow();
  const landed = useLanded(live.newBlock);
  const [q, setQ] = useState<FeedQuery>({ age: mode === "archive" ? 10 : 5, min: 0 });
  const [events, setEvents] = useState<GhostEvent[] | null>(null);
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // On narrow screens the side column sits far below the list, so a tap opens the preview as a sheet instead.
  const [sheet, setSheet] = useState(false);
  const pick = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia(SHEET_QUERY).matches) setSheet(true);
  };

  useEffect(() => {
    let alive = true;
    const url = `/api/${mode === "archive" ? "archive" : "feed"}${feedQueryString(q)}`;
    const load = () =>
      fetch(url, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: FeedPayload | { stats: FeedStats; events: GhostEvent[] }) => {
          if (!alive) return;
          setEvents(d.events);
          setStats(d.stats);
          setFailed(false);
        })
        .catch(() => alive && setFailed(true));
    load();
    const id = mode === "feed" ? setInterval(() => document.visibilityState === "visible" && load(), 30_000) : undefined;
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [q, mode]);

  const selected = useMemo(() => events?.find((e) => e.id === selectedId) ?? events?.[0] ?? null, [events, selectedId]);
  const largest = events?.reduce<GhostEvent | null>((m, e) => (!m || e.dormantSats > m.dormantSats ? e : m), null);
  const oldest = events?.reduce<GhostEvent | null>((m, e) => (!m || e.maxAgeSeconds > m.maxAgeSeconds ? e : m), null);

  return (
    <ViewCtx.Provider value={view}>
      <div className="gwx" data-view={view}>
        <ChainBar pulse={live.pulse} nowMs={now} view={view} choose={choose} area={mode} landed={landed} />

        <aside className="gw-col gwx-left" aria-label="Filters">
          <Panel title={mode === "feed" ? "Ghost feed" : "Archive"} meta={mode === "feed" ? "live" : "not live"} tone="ghost">
            <p className="gwx-intro">
              {mode === "feed"
                ? "Coins that sat unspent for five years or more, spent in confirmed blocks since GhostWatch started watching."
                : "Real awakenings from before GhostWatch went live, found by running the same detector over past blocks."}
            </p>
            {mode === "feed" && (
              <a href="/feed.xml" className="gwx-rss" title="Follow new awakenings in any feed reader. No account needed.">
                <RssIcon aria-hidden /> Follow with RSS
              </a>
            )}
          </Panel>
          <Panel title="Filter" className="gwx-filters-side">
            <Filters q={q} setQ={setQ} />
          </Panel>
          <Panel title="In view" meta={events ? `${events.length} events` : "…"}>
            <div className="rw"><span className="rw-dot" aria-hidden="true" /><span className="rw-l">Largest<em>{largest ? `from ${monthYear(largest.oldestCreatedTime)}` : ""}</em></span><span className="rw-v num">{largest ? btc(largest.dormantSats) : "—"}</span></div>
            <div className="rw"><span className="rw-dot rw-dot--g15" aria-hidden="true" /><span className="rw-l">Longest sleep<em>{oldest ? `${btc(oldest.dormantSats)}` : ""}</em></span><span className="rw-v num">{oldest ? durationShort(oldest.oldestCreatedTime, oldest.blockTime).replace(/ \d+d$/, "") : "—"}</span></div>
            <div className="rw"><span className="rw-dot rw-dot--u" aria-hidden="true" /><span className="rw-l">{mode === "feed" ? "Archive" : "Live so far"}<em>{mode === "feed" ? "past awakenings" : "since watching began"}</em></span><span className="rw-v num">{stats ? (mode === "feed" ? stats.archiveEvents : stats.liveEvents).toLocaleString("en-US") : "—"}</span></div>
          </Panel>
          <Panel title="Reading the colours">
            <div className="gwx-key">
              <span><i className="rw-dot rw-dot--g5" /> 5 to 10 years</span>
              <span><i className="rw-dot rw-dot--g10" /> 10 to 15 years</span>
              <span><i className="rw-dot rw-dot--g15" /> 15 years or more</span>
              <span className="muted">The older the coins, the stronger the mark.</span>
            </div>
          </Panel>
        </aside>

        <main className="gw-col gwx-center" id="main">
          <Panel title={mode === "feed" ? "Latest first" : "Largest first"} meta={failed ? "can't load right now" : events ? `${events.length} shown` : "loading"} className="gwx-list">
            {/* Phones: the filters sit above the list instead of below it. */}
            <div className="gwx-filters-top">
              <Filters q={q} setQ={setQ} compact />
            </div>
            {events && events.length === 0 && <p className="pn-empty">Nothing matches this filter.</p>}
            <ol className="gl">
              {(events ?? []).map((e) => {
                const { head, tail } = splitBtc(e.dormantSats);
                return (
                  <li key={e.id}>
                    <button type="button" className={`gl-i${selected?.id === e.id ? " is-on" : ""}`} data-age={e.cohort} onClick={() => pick(e.id)} aria-haspopup="dialog" aria-pressed={selected?.id === e.id}>
                      <span className={`rw-dot rw-dot--g${e.cohort}`} aria-hidden="true" />
                      <span className="gl-amt num">
                        {head}
                        <span className="lo">{tail}</span> <span className="u">BTC</span>
                      </span>
                      <span className="gl-what">
                        {view === "simple" ? `Unspent since ${monthYear(e.oldestCreatedTime)}` : `${e.dormantInputCount} of ${e.totalInputCount} inputs · ${short(e.txid, 5)}`}
                      </span>
                      <span className="gl-age num">{durationShort(e.oldestCreatedTime, e.blockTime).replace(/ \d+d$/, "")}</span>
                      <span className="gl-when">{view === "simple" ? dateShort(e.blockTime) : `#${e.blockHeight.toLocaleString("en-US")}`}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </main>

        <aside className="gw-col gwx-right" aria-label="Selected event">{selected ? <Preview e={selected} now={now} /> : <Panel title="Selected"><p className="pn-empty">{events ? "Pick an event to see it here." : "Loading…"}</p></Panel>}</aside>
        {sheet && selected && <PreviewSheet e={selected} now={now} onClose={() => setSheet(false)} />}
      </div>
    </ViewCtx.Provider>
  );
}

/** Age and amount filters. Compact: one row of two button groups, for the top of the list on phones. */
function Filters({ q, setQ, compact = false }: { q: FeedQuery; setQ: (q: FeedQuery) => void; compact?: boolean }) {
  return (
    <div className={compact ? "gwx-fc" : undefined}>
      <div className="gwx-filter" role="group" aria-label="Minimum age">
        {!compact && <span className="gwx-flabel">Unspent for</span>}
        <div className="gw-tablist">
          {AGE_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={q.age === o.value} onClick={() => setQ({ ...q, age: o.value })}>
              {o.value === 5 ? "5y+" : o.label.replace("Y+", "y+")}
            </button>
          ))}
        </div>
      </div>
      <div className="gwx-filter" role="group" aria-label="Minimum amount">
        {!compact && <span className="gwx-flabel">Amount</span>}
        <div className="gw-tablist">
          {MIN_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={q.min === o.value} onClick={() => setQ({ ...q, min: o.value })} aria-label={compact && o.value !== 0 ? `At least ${o.label}` : undefined}>
              {o.value === 0 ? "Any" : o.label.replace(" BTC", "")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Matches the breakpoint where the preview column stops sitting beside the list.
const SHEET_QUERY = "(max-width: 1180px)";

/** The preview as a bottom sheet on phones and tablets: slides up over a blurred backdrop. */
function PreviewSheet({ e, now, onClose }: { e: GhostEvent; now: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // No close() in cleanup: React's dev double-mount would fire the close event and dismiss it at once.
    const d = ref.current;
    lockScroll();
    if (d && !d.open) d.showModal();
    return unlockScroll;
  }, []);
  return (
    <dialog
      ref={ref}
      className="gwx-sheet"
      onClose={onClose}
      onClick={(ev) => ev.target === ref.current && ref.current?.close()}
      aria-label={`Selected event: ${satsToBtcString(e.dormantSats)} BTC`}
    >
      <div className="gwx-sheet-in">
        <div className="gwx-sheet-bar">
          <span className="gwx-sheet-grip" aria-hidden="true" />
          <button type="button" className="theme-btn" onClick={() => ref.current?.close()} aria-label="Close preview">
            <CloseIcon aria-hidden />
          </button>
        </div>
        <Preview e={e} now={now} />
      </div>
    </dialog>
  );
}

function Preview({ e, now }: { e: GhostEvent; now: number }) {
  const view = useView();
  const guide = signalGuide(e);
  const { head, tail } = splitBtc(e.dormantSats);
  return (
    <>
      <Panel title="Selected" meta={e.origin === "archive" ? "archive" : e.status} tone="ghost" className="gwx-preview">
        <div className="pv-amt num">
          {head}
          <span className="lo">{tail}</span>
          <span className="u">BTC</span>
        </div>
        <p className="pv-line">{ageClause(e)}, then moved.</p>
        <SleepTrack e={e} now={Math.floor(now / 1000)} />
        <div className="pv-ends">
          <span>Created {monthYear(e.oldestCreatedTime)}</span>
          <span>Spent {dateShort(e.blockTime)}</span>
        </div>
        <p className="pv-sum">{summary(e)}</p>
        {view === "technical" && (
          <dl className="pv-tech">
            <div><dt>Transaction</dt><dd>{short(e.txid, 8)}</dd></div>
            <div><dt>Block</dt><dd>{e.blockHeight.toLocaleString("en-US")}</dd></div>
            <div><dt>Dormant</dt><dd>{satsToBtcString(e.dormantSats)} BTC</dd></div>
            <div><dt>Spent</dt><dd>{dateTimeUtc(e.blockTime)}</dd></div>
          </dl>
        )}
        <Link href={`/e/${e.id}`} className="pv-open">Open the full evidence <ArrowRightIcon aria-hidden /></Link>
      </Panel>
      <Panel title="What it shows">
        <ul className="pv-g pv-g--obs">{guide.observed.slice(0, 2).map((t) => <li key={t}>{t}</li>)}</ul>
      </Panel>
      <Panel title="What it doesn't prove">
        <ul className="pv-g pv-g--not">{guide.notProof.map((t) => <li key={t}>{t}</li>)}</ul>
      </Panel>
    </>
  );
}
