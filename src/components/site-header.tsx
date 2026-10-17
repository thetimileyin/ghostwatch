import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./wordmark";

export type Section = "home" | "feed" | "archive" | "about" | "event";

const NAV: { href: string; label: string; short?: string; section: Section }[] = [
  { href: "/feed", label: "Feed", section: "feed" },
  { href: "/archive", label: "Archive", section: "archive" },
  { href: "/about", label: "How it works", short: "About", section: "about" },
];

/** Sticky top chrome (the top layer): brand, optional live status, and section nav. */
export function SiteHeader({ current, status }: { current: Section; status?: ReactNode }) {
  return (
    <header className="site-header">
      <div className="wrap bar">
        <Link className="brand" href="/" aria-label="GhostWatch home" aria-current={current === "home" ? "page" : undefined}>
          <Wordmark />
          <span className="wordmark">
            Ghost<span>Watch</span>
          </span>
        </Link>
        {status}
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} className="navlink" href={n.href} aria-current={current === n.section ? "page" : undefined}>
              {n.short ? (
                <>
                  <span className="hide-sm">{n.label}</span>
                  <span className="show-sm">{n.short}</span>
                </>
              ) : (
                n.label
              )}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
