import type { Metadata } from "next";
import Link from "next/link";
import { CohortTag } from "@/components/event-bits";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "How it works",
  description: "How GhostWatch finds dormant bitcoin, what an event does and doesn't prove, and what we don't collect.",
};

export default function About() {
  return (
    <>
      <SiteHeader current="about" />
      <main id="main" className="wrap prose-page">
        <div className="idx">[ <em>About</em> ] · Public beta</div>
        <h1>How GhostWatch works</h1>
        <p>
          Bitcoin is made of discrete chunks called <strong>outputs</strong>. Each one is created by a transaction and later spent whole. When
          an output sits unspent for years and is then spent, we call that an awakening, or a ghost.
        </p>

        <h2>What we check</h2>
        <ol>
          <li>For every confirmed block, we read each transaction&apos;s inputs together with the block each spent output came from.</li>
          <li>An input counts when the spending block&apos;s timestamp is at least five years after the creating block&apos;s timestamp.</li>
          <li>Each transaction with at least one counted input becomes one event, with a permanent page. Newer inputs are listed but not counted.</li>
        </ol>
        <p className="flex flex-wrap gap-3 items-center">
          <CohortTag cohort={5} /> <CohortTag cohort={10} /> <CohortTag cohort={15} /> Cohorts by the oldest counted output.
        </p>

        <h2>What an event doesn&apos;t prove</h2>
        <p>
          A transfer is not a sale. A move is not a hack. And the age of a coin says nothing about who owns it: early coins had many owners, so an
          old output moving is <strong>not</strong> evidence that Satoshi is back. Every event page separates what was observed from what it
          might mean.
        </p>

        <h2>Freshness and corrections</h2>
        <p>
          We only report confirmed blocks. The header tells you the last block we checked and when; if the detector falls behind or stops, the
          feed says so instead of pretending to be live. If a block is replaced by a chain reorganization, its events are marked
          <strong> reversed</strong> and keep their pages, and Telegram posts get a correction.
        </p>

        <h2>The archive</h2>
        <p>
          Events marked Archive happened before GhostWatch went live. We found them by running the same detector over past blocks, so they are
          real, but they were never live alerts.
        </p>

        <h2 id="privacy">Privacy</h2>
        <p>
          No accounts, no sign-ups, no email, no tracking pixels, no third-party analytics. The site remembers one number in your own browser,
          the last block you saw, to show what&apos;s new since your visit. Nothing about you is sent to us.
        </p>
        <p>
          We describe coins, not people. We don&apos;t label addresses with names, and we don&apos;t publish lists of vulnerable coins.
        </p>

        <h2>No token</h2>
        <p>
          There is no GhostWatch token or coin. Anyone selling one is not us.
        </p>

        <h2>Verify everything</h2>
        <p>
          Every event links to the transaction on <a className="underline" href="https://mempool.space" target="_blank" rel="noopener noreferrer">mempool.space</a>, an
          independent explorer. If our numbers and the chain ever disagree, the chain is right.
        </p>
      </main>
    </>
  );
}
