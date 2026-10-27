"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { WatchState } from "@/lib/watch-change";
import { describeChange } from "@/lib/watch-change";
import { BellIcon, CloseIcon, EyeIcon } from "./icons";

/**
 * Watch a coin: a short list kept only in this browser (localStorage). While a GhostWatch
 * tab is open it checks the list every minute and says when something changed: a watched
 * transaction confirmed or one of its coins moved on, or a watched address had new activity.
 */

export type WatchKind = "tx" | "address";
export interface WatchItem {
  kind: WatchKind;
  id: string;
  /** Short name for lists, e.g. "Transaction 138e8e…8d45fe". */
  label: string;
  addedAt: number;
  /** Last state seen; null until the first check. */
  seen: WatchState | null;
  /** What changed since the visitor last looked, in plain words. */
  news: string | null;
}

const KEY = "gw:watch";
const EVENT = "gw-watch";
const MAX = 20;
const POLL_MS = 60_000;

const keyOf = (w: { kind: WatchKind; id: string }) => `${w.kind}:${w.id}`;

function read(): WatchItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

let snapshot: WatchItem[] | null = null;
function write(list: WatchItem[]) {
  snapshot = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode: the list lasts for this page only */
  }
  window.dispatchEvent(new Event(EVENT));
}

function getSnapshot(): WatchItem[] {
  if (snapshot == null) snapshot = read();
  return snapshot;
}
const EMPTY: WatchItem[] = [];
function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = read();
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage); // other tabs
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useWatchList(): WatchItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export function clearNews(kind: WatchKind, id: string) {
  const list = getSnapshot();
  if (list.some((w) => w.kind === kind && w.id === id && w.news)) write(list.map((w) => (w.kind === kind && w.id === id ? { ...w, news: null } : w)));
}

async function check(items: { kind: WatchKind; id: string }[]): Promise<Record<string, WatchState | null> | null> {
  if (!items.length) return {};
  try {
    const r = await fetch(`/api/watch?items=${encodeURIComponent(items.map(keyOf).join(","))}`, { cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Watch / Watching toggle for a transaction or address page. */
export function WatchButton({ kind, id, label }: { kind: WatchKind; id: string; label: string }) {
  const list = useWatchList();
  const watching = list.some((w) => w.kind === kind && w.id === id);
  const full = !watching && list.length >= MAX;
  const [busy, setBusy] = useState(false);

  useEffect(() => clearNews(kind, id), [kind, id]); // seeing the page counts as having seen the news

  const toggle = async () => {
    if (watching) return write(getSnapshot().filter((w) => !(w.kind === kind && w.id === id)));
    if (full) return;
    setBusy(true);
    // Ask once, on this click: browser notifications are optional; the page note always works.
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    const now = await check([{ kind, id }]);
    write([...getSnapshot(), { kind, id, label, addedAt: Date.now(), seen: now?.[keyOf({ kind, id })] ?? null, news: null }]);
    setBusy(false);
  };

  return (
    <div className="wb">
      <button type="button" className={watching ? "wb-btn is-on" : "wb-btn"} onClick={toggle} disabled={busy || full} aria-pressed={watching}>
        {watching ? <BellIcon aria-hidden /> : <EyeIcon aria-hidden />}
        {watching ? "Watching" : busy ? "Adding…" : "Watch"}
      </button>
      <span className="wb-note">
        {full
          ? `You're watching ${MAX} already. Remove one to add this.`
          : watching
            ? `We'll tell you when ${kind === "tx" ? "it confirms or its coins move" : "coins arrive or leave"}, while GhostWatch is open. Saved only in this browser.`
            : `Get told when ${kind === "tx" ? "it confirms or its coins move" : "coins arrive or leave"}. Saved only in this browser; no account.`}
      </span>
    </div>
  );
}

/**
 * Runs once per page (mounted in the layout): checks the watch list every minute while the
 * tab is visible and shows a note, plus a browser notification if allowed, when something changed.
 */
export function WatchKeeper() {
  const list = useWatchList();
  const [toast, setToast] = useState<WatchItem | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined);

  const run = useCallback(async () => {
    const items = getSnapshot();
    if (!items.length || document.visibilityState !== "visible") return;
    const now = await check(items);
    if (!now) return;
    let changed: WatchItem | null = null;
    const next = getSnapshot().map((w) => {
      const s = now[keyOf(w)];
      if (!s) return w;
      const news = w.seen ? describeChange(w.seen, s) : null;
      if (news) changed = { ...w, seen: s, news };
      return { ...w, seen: s, news: news ?? w.news };
    });
    write(next);
    const c = changed as WatchItem | null;
    if (c) {
      setToast(c);
      clearTimeout(hide.current);
      hide.current = setTimeout(() => setToast(null), 12_000);
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(`GhostWatch: ${c.label}`, { body: c.news ?? "", tag: keyOf(c) });
        } catch {
          /* some browsers only allow notifications from a service worker */
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!list.length) return;
    const first = setTimeout(run, 5_000);
    const id = setInterval(run, POLL_MS);
    // Coming back to the tab checks straight away instead of waiting for the next minute.
    const onVisible = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [list.length, run]);

  if (!toast) return null;
  return (
    <div className="wtoast" role="status" aria-live="polite">
      <BellIcon aria-hidden className="wtoast-i" />
      <Link href={toast.kind === "tx" ? `/tx/${toast.id}` : `/address/${toast.id}`} className="wtoast-body" onClick={() => setToast(null)}>
        <b>{toast.label}</b>
        <span>{toast.news}</span>
      </Link>
      <button type="button" className="wtoast-x" onClick={() => setToast(null)} aria-label="Dismiss">
        <CloseIcon aria-hidden />
      </button>
    </div>
  );
}
