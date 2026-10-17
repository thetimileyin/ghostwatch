"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckIcon, CopyIcon, LinkIcon, ShareIcon, TelegramIcon, WhatsappIcon, XIcon } from "./icons";

const noop = () => () => {};

function useCopy() {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers that block the async clipboard API.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1600);
  };
  return { done, copy };
}

function Toast({ on, text }: { on: boolean; text: string }) {
  return (
    <div className="toast" data-on={on ? "" : undefined} role="status" aria-live="polite">
      {on && (
        <>
          <CheckIcon aria-hidden />
          {text}
        </>
      )}
    </div>
  );
}

/** Square icon button that copies a value; icon morphs to a check and a toast confirms. */
export function CopyButton({ value, label, toast, kind = "copy" }: { value: string; label: string; toast: string; kind?: "copy" | "link" }) {
  const { done, copy } = useCopy();
  const Icon = done ? CheckIcon : kind === "link" ? LinkIcon : CopyIcon;
  return (
    <>
      <button type="button" className="ib" aria-label={label} title={label} data-done={done ? "" : undefined} onClick={() => copy(value)}>
        <Icon aria-hidden />
      </button>
      <Toast on={done} text={toast} />
    </>
  );
}

/** Copy link is primary. Native share sheet when available (mobile), plus X, Telegram, WhatsApp. */
export function ShareBar({ url, text }: { url: string; text: string }) {
  const { done, copy } = useCopy();
  // Native share exists on most phones; false on the server so hydration matches.
  const canShare = useSyncExternalStore(noop, () => "share" in navigator, () => false);
  const enc = encodeURIComponent;
  return (
    <div className="share" aria-label="Share this event">
      <button type="button" className="btn btn--primary" onClick={() => copy(url)}>
        {done ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
        {done ? "Link copied" : "Copy link"}
      </button>
      {canShare && (
        <button type="button" className="btn" onClick={() => navigator.share({ title: text, url }).catch(() => {})}>
          <ShareIcon aria-hidden />
          Share
        </button>
      )}
      <a className="btn" href={`https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer">
        <XIcon aria-hidden />
        Post
      </a>
      <a className="btn" href={`https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`} target="_blank" rel="noopener noreferrer">
        <TelegramIcon aria-hidden />
        Telegram
      </a>
      <a className="btn" href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">
        <WhatsappIcon aria-hidden />
        WhatsApp
      </a>
      <Toast on={done} text="Link copied" />
    </div>
  );
}
