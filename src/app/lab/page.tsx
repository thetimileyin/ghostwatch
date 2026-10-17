import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Concepts" };

const CONCEPTS = [
  { slug: "network", name: "A · The Living Network", body: "A full-screen live field. Transactions drift in, notable ones glow, blocks pull them in. Real node locations in the background." },
  { slug: "observatory", name: "B · The Bitcoin Observatory", body: "A 24-hour dial of every block, with old-coin awakenings as stars and a live arc counting toward the next block." },
  { slug: "machine", name: "C · The Block Machine", body: "How Bitcoin works, shown live: queued blocks, a now line, mined blocks landing. Each transaction drops into the next block." },
];

export default function LabIndex() {
  return (
    <>
      <SiteHeader current="home" />
      <main id="main" className="wrap">
        <section className="home-hero" style={{ textAlign: "left", paddingTop: 72 }}>
          <div className="idx">[ <em>Lab</em> ] · Three directions, real data</div>
          <h1 className="h-display" style={{ marginTop: 20, fontSize: "clamp(34px, 5vw, 60px)" }}>
            Three ways to watch Bitcoin.
            <br />
            <span className="dim">Pick the one that feels right.</span>
          </h1>
          <p className="lede" style={{ marginInline: 0 }}>
            Each concept runs on the same live data: price, blocks, the waiting queue, notable transactions and old coins waking up. Each has a
            Simple and a Technical view.
          </p>
        </section>
        <ul className="list" style={{ marginBottom: 96 }}>
          {CONCEPTS.map((c) => (
            <li key={c.slug} className="list-item list-item--lead">
              <Link href={`/lab/${c.slug}`} className="list-link">
                <span aria-hidden="true" className="dot dot--live" style={{ marginTop: 10 }} />
                <div>
                  <div className="list-title">{c.name}</div>
                  <div className="list-desc">{c.body}</div>
                </div>
                <span className="list-meta meta--live">Live</span>
                <ArrowRightIcon className="list-go" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
