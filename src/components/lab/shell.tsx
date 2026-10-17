"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usd } from "@/lib/pulse/format";
import { Wordmark } from "../wordmark";

import { ViewCtx, useViewPreference } from "./view";

export { useView, type View } from "./view";

export const CONCEPTS = [
  { slug: "network", name: "Living Network" },
  { slug: "observatory", name: "Observatory" },
  { slug: "machine", name: "Block Machine" },
] as const;

const SOON = [
  { name: "Vault tripwire", what: "A private alert when coins leave your cold storage. Watch-only, no account." },
  { name: "Haunted coin check", what: "Is a coin's public key already exposed on-chain? The main quantum risk." },
  { name: "Watchlists", what: "Follow addresses or old coins you care about, stored only on your device." },
  { name: "Alerts & API", what: "Telegram alerts for big moves; webhooks and an MCP server for builders." },
];

/**
 * Chrome shared by the three concepts: brand, concept switcher, price,
 * Simple/Technical toggle, and the roadmap (Coming soon) in the nav.
 */
export function LabShell({ concept, price, children }: { concept: string; price: number | null; children: ReactNode }) {
  const [view, choose] = useViewPreference();

  return (
    <ViewCtx.Provider value={view}>
      <div className="lab" data-view={view}>
        <header className="lab-top">
          <Link href="/lab" className="brand" aria-label="GhostWatch concepts">
            <Wordmark size={22} />
            <span className="wordmark">
              Ghost<span>Watch</span>
            </span>
          </Link>
          <nav className="lab-concepts" aria-label="Concept">
            {CONCEPTS.map((c) => (
              <Link key={c.slug} href={`/lab/${c.slug}`} aria-current={c.slug === concept ? "page" : undefined}>
                {c.name}
              </Link>
            ))}
          </nav>
          <div className="lab-right">
            <span className="lab-price" title="Bitcoin price (USD), via mempool.space">
              <span className="muted">BTC</span> <b className="num">{usd(price)}</b>
            </span>
            <div className="lab-toggle" role="radiogroup" aria-label="Level of detail">
              {(["simple", "technical"] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => choose(v)}>
                  {v === "simple" ? "Simple" : "Technical"}
                </button>
              ))}
            </div>
          </div>
        </header>
        <nav className="lab-roadmap" aria-label="Product">
          <Link href={`/lab/${concept}`} aria-current="page">
            <span className="dot dot--live" aria-hidden="true" /> Terminal
          </Link>
          <Link href="/feed">Ghost feed</Link>
          <Link href="/archive">Archive</Link>
          <span className="lab-roadmap-sep" aria-hidden="true" />
          {SOON.map((s) => (
            <span key={s.name} className="soon" tabIndex={0} aria-describedby={`soon-${s.name}`}>
              {s.name}
              <em>Soon</em>
              <span className="soon-tip" role="tooltip" id={`soon-${s.name}`}>
                {s.what}
              </span>
            </span>
          ))}
        </nav>
        {children}
      </div>
    </ViewCtx.Provider>
  );
}
