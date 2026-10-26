import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LandingLive } from "@/components/console/landing-stream";
import { ArrowRightIcon } from "@/components/icons";
import { MobileMenu } from "@/components/mobile-menu";
import { NextCards } from "@/components/next-cards";
import { ThemeSwitch } from "@/components/theme-switch";
import { Wordmark } from "@/components/wordmark";
import "./landing.css";

// Landing: one screen into the terminal, then what's coming next.


export default function Home() {
  return (
    <>
      <div className="lx">
        <header className="lx-top">
          <div className="lx-frame lx-top-in">
            <Link className="brand" href="/" aria-label="GhostWatch home">
              <Wordmark />
              <span className="wordmark">
                Ghost<span>Watch</span>
              </span>
            </Link>
            <nav className="lx-nav" aria-label="Main">
              <Link href="/terminal">Terminal</Link>
              <Link href="/feed">Ghost feed</Link>
              <Link href="/archive">Archive</Link>
              <Link href="/about">How it works</Link>
            </nav>
            <ThemeSwitch className="lx-theme" />
            <Link href="/terminal" className="lx-btn lx-btn--primary lx-btn--sm lx-top-cta">
              Open terminal <ArrowRightIcon aria-hidden />
            </Link>
            <MobileMenu>
              <nav className="mm-links" aria-label="Main">
                <Link href="/terminal">Terminal <ArrowRightIcon aria-hidden /></Link>
                <Link href="/feed">Ghost feed <ArrowRightIcon aria-hidden /></Link>
                <Link href="/archive">Archive <ArrowRightIcon aria-hidden /></Link>
                <Link href="/about">How it works <ArrowRightIcon aria-hidden /></Link>
              </nav>
              <div className="mm-row">
                <Link href="/terminal" className="lx-btn lx-btn--primary lx-btn--block">
                  Open terminal <ArrowRightIcon aria-hidden />
                </Link>
              </div>
            </MobileMenu>
          </div>
        </header>

        <main id="main" className="lx-frame lx-main">
          <Suspense fallback={<div className="lx-scene" aria-hidden="true" />}>
            <Live>
              <LandingLive />
            </Live>
          </Suspense>

          <section className="lx-hero" aria-labelledby="lx-h">
            <div className="lx-kicker">[ Live Bitcoin intelligence ]</div>
            <h1 id="lx-h">
              <span className="lx-line">Watch Bitcoin move</span>
              <br />
              <span className="dim">in real time.</span>
            </h1>
            <p className="lx-lede">
              Blocks, big transfers and coins waking up after years, in one live terminal. Plain words by default, the raw numbers when you want them.
            </p>
            <div className="lx-ctas">
              <Link href="/terminal" className="lx-btn lx-btn--primary">
                Open the terminal <ArrowRightIcon aria-hidden />
              </Link>
              <Link href="/about" className="lx-btn">
                How it works
              </Link>
            </div>
            <p className="lx-note">No accounts. No wallet. Public Bitcoin data only.</p>
          </section>
        </main>
      </div>

      <section className="lx-frame lx-next" aria-labelledby="next-h">
        <div className="section-label">
          <div className="idx">
            [ <em>Next</em> ] · <b>Coming soon</b>
          </div>
        </div>
        <h2 id="next-h" className="h-section">
          The terminal is live.
          <br />
          <span className="dim">Here&apos;s what comes next.</span>
        </h2>
        <NextCards />
      </section>
    </>
  );
}

async function Live({ children }: { children: React.ReactNode }) {
  await connection();
  return children;
}
