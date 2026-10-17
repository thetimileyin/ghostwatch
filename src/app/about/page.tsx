import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { ExternalLinkIcon } from "@/components/icons";
import "./about.css";

export const metadata: Metadata = {
  title: "How it works",
  description: "How GhostWatch finds dormant bitcoin, what an event does and doesn't prove, and what we don't collect.",
};

const STEPS = [
  { k: "Read", t: "Every confirmed block", d: "For each transaction, we look at every input and the block that created the output it spends." },
  { k: "Measure", t: "Age of each output", d: "Spending block time minus creating block time. Per output, not per wallet." },
  { k: "Count", t: "Five years or more", d: "Only outputs unspent for at least five years count. Newer inputs are listed but not counted." },
  { k: "Publish", t: "One event per transaction", d: "Each gets a permanent page that tells its story and links to the raw data." },
];

const SECTIONS = [
  { id: "proof", n: "02", h: "What an event doesn't prove" },
  { id: "freshness", n: "03", h: "Freshness and corrections" },
  { id: "archive", n: "04", h: "The archive" },
  { id: "privacy", n: "05", h: "Privacy" },
  { id: "token", n: "06", h: "No token" },
  { id: "verify", n: "07", h: "Verify everything" },
];

export default function About() {
  return (
    <div className="ab">
      <PageHeader back={{ href: "/terminal", label: "Terminal" }} />
      <main id="main" className="pg-frame">
        <section className="ab-hero" aria-labelledby="ab-h">
          <p className="ab-idx">[ How it works ]</p>
          <h1 id="ab-h">
            Old coins leave tracks.
            <br />
            <span className="dim">Here&apos;s how we read them.</span>
          </h1>
          <p className="ab-lede">
            Bitcoin is made of discrete chunks called <b>outputs</b>. Each one is created by a transaction and later spent whole. When an output sits
            unspent for years and is then spent, we call that an awakening.
          </p>
        </section>

        <section className="ab-sec" aria-labelledby="check">
          <p className="ab-idx">[01]</p>
          <h2 id="check">What we check</h2>
          <ol className="ab-steps">
            {STEPS.map((s, i) => (
              <li key={s.k}>
                <span className="ab-step-k">{String(i + 1).padStart(2, "0")} · {s.k}</span>
                <b>{s.t}</b>
                <span>{s.d}</span>
              </li>
            ))}
          </ol>
          <div className="ab-cohorts" aria-label="Cohorts">
            <span><i className="c5" /> 5 to 10 years</span>
            <span><i className="c10" /> 10 to 15 years</span>
            <span><i className="c15" /> 15 years or more</span>
            <em>Grouped by the oldest counted output.</em>
          </div>
        </section>

        <nav className="ab-toc" aria-label="On this page">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>[{s.n}] {s.h}</a>
          ))}
        </nav>

        <section className="ab-sec ab-sec--text" id="proof" aria-labelledby="proof-h">
          <p className="ab-idx">[02]</p>
          <h2 id="proof-h">What an event doesn&apos;t prove</h2>
          <div>
            <p>
              A transfer is not a sale. A move is not a hack. And the age of a coin says nothing about who owns it: early coins had many owners, so an
              old output moving is <b>not</b> evidence that Satoshi is back.
            </p>
            <p>Every event page separates what was observed from what it might mean, and lists what it doesn&apos;t prove.</p>
          </div>
        </section>

        <section className="ab-sec ab-sec--text" id="freshness" aria-labelledby="fresh-h">
          <p className="ab-idx">[03]</p>
          <h2 id="fresh-h">Freshness and corrections</h2>
          <div>
            <p>
              We only report confirmed blocks, and each event page notes the last block we checked. If a block is replaced by a chain
              reorganization, its events are marked <b>reversed</b> and keep their pages, and Telegram posts get a correction.
            </p>
          </div>
        </section>

        <section className="ab-sec ab-sec--text" id="archive" aria-labelledby="arch-h">
          <p className="ab-idx">[04]</p>
          <h2 id="arch-h">The archive</h2>
          <div>
            <p>
              Events marked Archive happened before GhostWatch went live. We found them by running the same detector over past blocks, so they are
              real, but they were never live alerts.
            </p>
          </div>
        </section>

        <section className="ab-sec ab-sec--text" id="privacy" aria-labelledby="priv-h">
          <p className="ab-idx">[05]</p>
          <h2 id="priv-h">Privacy</h2>
          <div>
            <p>
              No accounts, no sign-ups, no email, no tracking pixels, no third-party analytics. All Bitcoin data is fetched by our server, so your
              browser never contacts a third party while you use the site.
            </p>
            <p>
              Your browser remembers two preferences, and only on your device: Simple or Technical, and light or dark. Nothing about you is sent
              to us.
            </p>
            <p>We describe coins, not people. We don&apos;t label addresses with names, and we don&apos;t publish lists of vulnerable coins.</p>
          </div>
        </section>

        <section className="ab-sec ab-sec--text" id="token" aria-labelledby="token-h">
          <p className="ab-idx">[06]</p>
          <h2 id="token-h">No token</h2>
          <div>
            <p>There is no GhostWatch token or coin. Anyone selling one is not us.</p>
          </div>
        </section>

        <section className="ab-sec ab-sec--text" id="verify" aria-labelledby="verify-h">
          <p className="ab-idx">[07]</p>
          <h2 id="verify-h">Verify everything</h2>
          <div>
            <p>
              Every event links to the transaction on mempool.space, an independent explorer. If our numbers and the chain ever disagree, the chain
              is right.
            </p>
            <a className="ab-btn" href="https://mempool.space" target="_blank" rel="noopener noreferrer">
              Open mempool.space <ExternalLinkIcon aria-hidden />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
