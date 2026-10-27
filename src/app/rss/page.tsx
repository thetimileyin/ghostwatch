import type { Metadata } from "next";
import { CopyButton } from "@/components/copy";
import { ExternalLinkIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import "../e/[id]/story.css";
import "../tx/[txid]/journey.css";

const BASE = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "Follow with RSS",
  description: "Get every coin that wakes up after five years or more in your feed reader. No account, nothing tracked.",
};

export default function RssPage() {
  const url = `${BASE}/feed.xml`;
  return (
    <div className="st jr">
      <PageHeader back={{ href: "/feed", label: "Ghost feed" }} />
      <main id="main" className="pg-frame">
        <section className="st-hero" aria-labelledby="rss-h">
          <p className="st-kicker">[ RSS ] · No account</p>
          <h1 id="rss-h">
            Old coins waking up,
            <br />
            <span className="dim">in your feed reader.</span>
          </h1>
          <p className="jr-lede">
            Every time coins that sat unspent for five years or more move, a new item appears: how much, how long it slept, and a link to its
            story. Your reader checks the feed; GhostWatch never learns who is following.
          </p>
        </section>

        <section className="st-ch st-ch--wide" aria-labelledby="rss-1">
          <div className="st-ch-text">
            <p className="st-idx">[01] Copy the feed address</p>
            <h2 id="rss-1">This is the address your reader needs.</h2>
          </div>
          <dl className="ledger rss-url">
            <div>
              <dt>Feed</dt>
              <dd><span className="hash"><code title={url}>{url}</code><CopyButton value={url} label="Copy feed address" toast="Feed address copied" kind="link" /></span></dd>
            </div>
          </dl>
        </section>

        <section className="st-ch st-ch--wide" aria-labelledby="rss-2">
          <div className="st-ch-text">
            <p className="st-idx">[02] Add it to a reader</p>
            <h2 id="rss-2">Paste it wherever you follow feeds.</h2>
            <p>
              In most readers that&apos;s an &ldquo;Add feed&rdquo; or &ldquo;+&rdquo; button. Free options include NetNewsWire on Apple devices, Feeder
              on Android, and Thunderbird on desktop.
            </p>
            <p>How quickly a new item reaches you depends on how often your reader checks; many check about once an hour.</p>
          </div>
          <div className="st-verify">
            <a href="/feed.xml" className="st-btn" target="_blank" rel="noopener noreferrer">Open the raw feed <ExternalLinkIcon aria-hidden /></a>
          </div>
        </section>
      </main>
    </div>
  );
}
