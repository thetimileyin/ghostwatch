"use client";

import { useRouter } from "next/navigation";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { addressType, normalizeAddress } from "@/lib/journey/address";
import { isTxid } from "@/lib/journey/journey";
import { ArrowRightIcon, GhostIcon, SearchIcon } from "./icons";

type Row = { key: string; href: string; kind: string; label: string; hint: string; old?: boolean };
type Suggest = { block: { height: number; time: number; txCount: number } | null; woke: { txid: string; dormantSats: number; maxAgeSeconds: number }[] };

const short = (s: string, k = 6) => (s.length > k * 2 + 1 ? `${s.slice(0, k)}…${s.slice(-k)}` : s);
const btc = (sats: number) => `${(sats / 1e8).toLocaleString("en-US", { maximumFractionDigits: sats >= 1e10 ? 2 : 4 })} BTC`;
const years = (sec: number) => `${Math.floor(sec / (365.2425 * 86400))} years`;

/** What a pasted value is, as the one row to open; or a plain hint when it's none of them. */
function detect(raw: string): Row | string | null {
  const v = raw.trim();
  if (!v) return null;
  if (isTxid(v)) {
    const id = v.toLowerCase();
    // Block hashes start with a long run of zeros (proof of work); transaction IDs practically never do.
    if (/^0{8}/.test(id)) return { key: "b", href: `/block/${id}`, kind: "Block", label: short(id), hint: "See what was inside" };
    return { key: "t", href: `/tx/${id}`, kind: "Transaction", label: short(id), hint: "Follow its journey" };
  }
  if (addressType(v)) {
    const a = normalizeAddress(v);
    return { key: "a", href: `/address/${a}`, kind: "Address", label: short(a), hint: "See what it holds" };
  }
  if (/^\d{1,7}$/.test(v.replace(/,/g, ""))) {
    const h = Number(v.replace(/,/g, ""));
    return { key: "h", href: `/block/${h}`, kind: "Block", label: h.toLocaleString("en-US"), hint: "See what was inside" };
  }
  if (/^[0-9a-f]+$/i.test(v) && v.length < 64) return `That's ${v.length} characters. A transaction ID or block hash has 64.`;
  return "Paste a transaction ID, an address (1…, 3…, bc1…) or a block number.";
}

/**
 * The search box: paste a transaction ID, an address or a block, open its journey.
 * Before anything is typed it suggests the newest block and coins that just woke up.
 */
export function GhostSearch({ autoFocus, onDone, inDialog }: { autoFocus?: boolean; onDone?: () => void; inDialog?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [suggest, setSuggest] = useState<Suggest | null>(null);

  useEffect(() => {
    if (!inDialog) return;
    let alive = true;
    fetch("/api/search-suggest")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Suggest | null) => alive && setSuggest(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [inDialog]);

  const found = detect(q);
  const rows: { title: string; items: Row[] }[] = useMemo(() => {
    if (found && typeof found !== "string") return [{ title: "Open", items: [found] }];
    if (q.trim() || !suggest) return [];
    const groups: { title: string; items: Row[] }[] = [];
    if (suggest.woke.length)
      groups.push({
        title: "Recently woke up",
        items: suggest.woke.map((w, i) => ({ key: `w${i}`, href: `/tx/${w.txid}`, kind: btc(w.dormantSats), label: `slept ${years(w.maxAgeSeconds)}`, hint: "Follow", old: true })),
      });
    if (suggest.block)
      groups.push({
        title: "Latest block",
        items: [{ key: "lb", href: `/block/${suggest.block.height}`, kind: "Block", label: suggest.block.height.toLocaleString("en-US"), hint: `${suggest.block.txCount.toLocaleString("en-US")} transactions` }],
      });
    return groups;
  }, [found, q, suggest]);
  const flat = rows.flatMap((g) => g.items);
  const current = flat[Math.min(active, flat.length - 1)];

  const open = (r: Row | undefined) => {
    if (!r) return;
    onDone?.();
    router.push(r.href);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") setActive((a) => Math.min(flat.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Enter") open(current);
    else return;
    e.preventDefault();
  };

  return (
    <div className={inDialog ? "gs gs--dialog" : "gs"} role="search">
      <div className="gs-in">
        <SearchIcon aria-hidden className="gs-icon" />
        <input
          className="gs-field"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          placeholder="Transaction ID, address or block"
          aria-label="Paste a transaction ID, address or block number"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls={listId}
          aria-activedescendant={current ? `${listId}-${current.key}` : undefined}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
        />
        {inDialog ? <kbd className="gs-esc">esc</kbd> : <button type="button" className="gs-go" onClick={() => open(current)} disabled={!current}>Open</button>}
      </div>

      <div id={listId} role="listbox" aria-label="Results" className="gs-list">
        {typeof found === "string" && <p className="gs-hint" role="status">{found}</p>}
        {rows.map((g) => (
          <div key={g.title} role="group" aria-label={g.title}>
            <p className="gs-group">{g.title}</p>
            {g.items.map((r) => {
              const i = flat.indexOf(r);
              return (
                <div
                  key={r.key}
                  id={`${listId}-${r.key}`}
                  role="option"
                  aria-selected={current === r}
                  className={`gs-row${current === r ? " is-active" : ""}${r.old ? " gs-row--old" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => open(r)}
                >
                  {r.old ? <GhostIcon aria-hidden className="gs-row-i" /> : <span className="gs-kind">{r.kind}</span>}
                  <span className="gs-label">{r.old ? <><b className="num">{r.kind}</b> {r.label}</> : <code>{r.label}</code>}</span>
                  <span className="gs-hint-r">{r.hint} <ArrowRightIcon aria-hidden /></span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {inDialog && (
        <div className="gs-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>↵</kbd> open</span>
          <span className="gs-foot-note">Nothing you search is stored</span>
        </div>
      )}
    </div>
  );
}

/** Search button for headers; also opens with the / key. */
export function SearchButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button type="button" className={`txs-btn ${className}`} onClick={() => setOpen(true)} aria-label="Search a transaction, address or block (press /)" title="Search (/)">
        <SearchIcon aria-hidden />
      </button>
      {/* Rendered at the end of <body>, not inside the header: the top bar measures its own
          contents to decide whether it fits on one row, and must never count the dialog. */}
      {open && createPortal(<SearchDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // Open once; no close() in cleanup (React's dev double-mount would dismiss it at once).
    const d = ref.current;
    lockScroll();
    if (d && !d.open) d.showModal();
    return unlockScroll;
  }, []);
  return (
    <dialog ref={ref} className="txs-dialog" onClose={onClose} aria-label="Search" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <GhostSearch autoFocus inDialog onDone={onClose} />
    </dialog>
  );
}
