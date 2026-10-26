"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { isTxid } from "@/lib/journey/journey";
import { SearchIcon } from "./icons";

/** What someone pasted, in plain words, when it isn't something we can follow yet. */
function explain(v: string): string {
  if (/^(bc1|tb1)[a-z0-9]{8,}$/i.test(v) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(v)) return "Addresses are coming next. For now, paste a transaction ID.";
  if (/^\d{1,7}$/.test(v)) return "Blocks are coming next. For now, paste a transaction ID.";
  return "That isn't a transaction ID. A transaction ID is 64 characters of 0–9 and a–f.";
}

/** One field: paste a transaction ID, follow its journey. */
export function TxSearchForm({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    if (!v) return;
    if (isTxid(v)) {
      setMsg(null);
      onDone?.();
      router.push(`/tx/${v.toLowerCase()}`);
    } else setMsg(explain(v));
  };
  return (
    <form className="txs" onSubmit={submit} role="search">
      <label htmlFor="txs-q" className="txs-l">Follow a transaction</label>
      <div className="txs-row">
        <input
          id="txs-q"
          name="q"
          className="txs-in"
          placeholder="Paste a transaction ID"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-describedby="txs-msg"
          onChange={() => msg && setMsg(null)}
        />
        <button type="submit" className="txs-go">Follow</button>
      </div>
      <p id="txs-msg" className={msg ? "txs-msg txs-msg--warn" : "txs-msg"} aria-live="polite">
        {msg ?? "We look it up on our server. Nothing you search is stored."}
      </p>
    </form>
  );
}

/** Search button for headers; also opens with the / key. */
export function SearchButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      <button type="button" className={`txs-btn ${className}`} onClick={() => setOpen(true)} aria-label="Follow a transaction (press /)" title="Follow a transaction (/)">
        <SearchIcon aria-hidden />
      </button>
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // Open once; no close() in cleanup (React's dev double-mount would dismiss it at once).
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="txs-dialog"
      onClose={onClose}
      aria-label="Follow a transaction"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <TxSearchForm autoFocus onDone={onClose} />
    </dialog>
  );
}
