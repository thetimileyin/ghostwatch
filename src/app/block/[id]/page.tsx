import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy";
import { ArrowLeftIcon, ArrowRightIcon, ExternalLinkIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { BlockGlyph, HALVING_INTERVAL, subsidyAt } from "@/components/story/visuals";
import { GhostSearch } from "@/components/tx-search";
import { amountWords, dateShort, dateTimeUtc, durationLong, heightLabel, middleTruncate, satsToBtcString, spanWords } from "@/lib/domain/format";
import { getBlockStory } from "@/lib/journey/block";
import { priceOnDay } from "@/lib/pulse/prices";
import { getPriceHistory } from "@/lib/pulse/price-server";
import "../../e/[id]/story.css";
import "../../tx/[txid]/journey.css";

type Params = Promise<{ id: string }>;
const EXPLORER = "https://mempool.space";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: /^\d+$/.test(id) ? `Block ${Number(id).toLocaleString("en-US")}` : "Block",
    description: "When this block was found, who mined it, what was inside, and any old coins that woke up in it.",
  };
}

export default function BlockPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Loading />}>
      <BlockContent params={params} />
    </Suspense>
  );
}

const usd = (n: number) => (n < 0.01 ? "under a cent" : n < 100 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString("en-US")}`);
const n = (x: number) => x.toLocaleString("en-US");
const rate = (x: number) => (x < 10 ? x.toFixed(1) : Math.round(x).toLocaleString("en-US"));

/** "7 minutes" / "1 hour 4 minutes" between blocks; the target is 10 minutes. */
function gap(sec: number): string {
  if (sec < 60) return `${Math.max(0, sec)} seconds`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h} hour${h === 1 ? "" : "s"}${r ? ` ${r} minute${r === 1 ? "" : "s"}` : ""}`;
}

async function BlockContent({ params }: { params: Params }) {
  await connection();
  const { id } = await params;
  const r = await getBlockStory(decodeURIComponent(id));
  if (r.kind !== "ok") return <NotFollowable kind={r.kind} />;
  const b = r.block;
  const hist = await getPriceHistory().catch(() => null);
  const price = priceOnDay(hist, b.time);
  const now = Math.floor(Date.now() / 1000);
  const subsidy = subsidyAt(b.height);
  const subsidySats = Math.round(subsidy * 1e8);
  const feesSats = b.totalFeesSats ?? (b.rewardSats != null ? b.rewardSats - subsidySats : null);
  const rewardSats = b.rewardSats ?? (feesSats != null ? subsidySats + feesSats : subsidySats);
  const nextHalving = (Math.floor(b.height / HALVING_INTERVAL) + 1) * HALVING_INTERVAL;
  const genesis = b.height === 0;
  const watched = b.checkedTo != null && b.height <= b.checkedTo;

  return (
    <div className="st jr">
      <PageHeader back={{ href: "/terminal", label: "Terminal" }} />
      <main id="main" className="pg-frame">
        <section className="st-hero" aria-labelledby="bk-h">
          <p className="st-kicker">[ Block {heightLabel(b.height)} ] · {b.confirmations <= 1 ? "The newest block" : `${n(b.confirmations - 1)} blocks deep`}</p>
          <h1 id="bk-h">
            Block <span className="num">{heightLabel(b.height)}</span>.
            <br />
            <span className="dim">
              {genesis
                ? "The first block. Satoshi mined it on 3 January 2009."
                : `Found ${dateShort(b.time)}${b.pool ? ` by ${b.pool}` : ""}${b.sincePrevious != null ? `, ${gap(b.sincePrevious)} after the one before` : ""}.`}
            </span>
          </h1>
          <nav className="jr-blocknav" aria-label="Neighbouring blocks">
            {b.previousHash ? <Link href={`/block/${b.height - 1}`} className="jr-follow"><ArrowLeftIcon aria-hidden /> Block {heightLabel(b.height - 1)}</Link> : <span />}
            {b.nextHash ? <Link href={`/block/${b.height + 1}`} className="jr-follow">Block {heightLabel(b.height + 1)} <ArrowRightIcon aria-hidden /></Link> : <span className="jr-next">No newer block yet</span>}
          </nav>
          <p className="jr-lede">
            A block is a batch of transactions that a miner sealed onto the chain. Miners race to find the next one; on average one is found every
            ten minutes, and each pays its miner a reward.
          </p>
        </section>

        {/* 01 */}
        <section className="st-ch" aria-labelledby="ch1">
          <div className="st-ch-text">
            <p className="st-idx">[01] How it was made</p>
            <h2 id="ch1">The miner earned {amountWords(rewardSats)}{price != null ? `, about ${usd((rewardSats / 1e8) * price)} at the time` : ""}.</h2>
            <p>
              That&apos;s <b className="num">{subsidy} BTC</b> of brand-new bitcoin
              {feesSats != null && feesSats > 0 ? <> plus <b className="num">{amountWords(feesSats)}</b> in fees paid by the transactions inside</> : null}.
              {feesSats != null && rewardSats > 0 && feesSats > 0 ? <> Fees were {((feesSats / rewardSats) * 100).toFixed(feesSats / rewardSats < 0.01 ? 2 : 1)}% of the reward.</> : null}
            </p>
            <p>
              Every block in this era pays {subsidy} BTC. The reward halves every 210,000 blocks; the next cut is at block <b className="num">{heightLabel(nextHalving)}</b>
              {nextHalving > b.height ? <>, {n(nextHalving - b.height)} blocks after this one</> : null}.
            </p>
            {b.coinbaseTxid && (
              <p><Link href={`/tx/${b.coinbaseTxid}`} className="jr-follow">Follow the miner&apos;s reward <ArrowRightIcon aria-hidden /></Link></p>
            )}
          </div>
          <BlockGlyph height={b.height} value={rewardSats} txCount={b.txCount} fullness={b.fullness || null} scriptType={null} mark={null} valueLabel="reward" />
        </section>

        {/* 02 */}
        <section className="st-ch" aria-labelledby="ch2">
          <div className="st-ch-text">
            <p className="st-idx">[02] What was inside</p>
            <h2 id="ch2">{n(b.txCount)} transaction{b.txCount === 1 ? "" : "s"}{b.fullness ? `, ${Math.round(b.fullness * 100)}% full` : ""}.</h2>
            {b.fees && b.fees.high > 0 ? (
              <p>
                The cheapest paid <b className="num">{rate(b.fees.low)} sat/vB</b> to get in, a typical one <b className="num">{rate(b.fees.typical)} sat/vB</b>, and the most
                eager <b className="num">{rate(b.fees.high)} sat/vB</b>. Miners fill blocks with the best-paying transactions first.
              </p>
            ) : (
              <p>{genesis ? "Only the miner's reward: there was no one else to send bitcoin yet." : "Only the miner's reward was inside."}</p>
            )}
          </div>
        </section>

        {/* 03 */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch3">
          <div className="st-ch-text">
            <p className="st-idx">[03] Old coins in this block</p>
            {b.awakenings.length > 0 ? (
              <h2 id="ch3">{b.awakenings.length === 1 ? "Old coins woke up here." : `${b.awakenings.length} transactions woke old coins here.`}</h2>
            ) : (
              <>
                <h2 id="ch3">{watched ? "No coins five years or older moved here." : "GhostWatch hasn't checked this block."}</h2>
                <p>{watched ? "GhostWatch read every transaction in this block." : "We read blocks from when GhostWatch started watching, plus a set of past blocks for the archive."}</p>
              </>
            )}
          </div>
          {b.awakenings.length > 0 && (
            <div className="jr-list">
              <ol>
                {b.awakenings.map((e) => (
                  <li key={e.id} className="jr-row jr-row--old">
                    <span className="jr-amt num">{amountWords(e.dormantSats)}</span>
                    <span className="jr-what">slept {durationLong(e.oldestCreatedTime, e.blockTime)}</span>
                    <Link href={`/e/${e.id}`} className="jr-follow">The story <ArrowRightIcon aria-hidden /></Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* 04 */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch4">
          <div className="st-ch-text">
            <p className="st-idx">[04] Its place in the chain</p>
            <h2 id="ch4">{b.confirmations <= 1 ? "It's the newest block." : `${n(b.confirmations - 1)} blocks have been built on top.`}</h2>
            <p>
              {b.confirmations <= 1
                ? "The next block will be built on top of it, and every one after that makes it harder to change."
                : `That's ${spanWords(b.time, now)} of mining since. Changing this block would mean redoing all of that work.`}
            </p>
          </div>
          <div className="st-verify">
            <a href={`${EXPLORER}/block/${b.hash}`} target="_blank" rel="noopener noreferrer" className="st-btn st-btn--primary">Block on mempool.space <ExternalLinkIcon aria-hidden /></a>
          </div>
          <details className="st-details">
            <summary>Full details</summary>
            <dl className="ledger">
              <div><dt>Height</dt><dd className="num">{heightLabel(b.height)}</dd></div>
              <div><dt>Hash</dt><dd><span className="hash"><code title={b.hash}>{b.hash}</code><CopyButton value={b.hash} label="Copy block hash" toast="Block hash copied" /></span></dd></div>
              <div><dt>Time</dt><dd>{dateTimeUtc(b.time)}</dd></div>
              <div><dt>Mined by</dt><dd>{b.pool ?? "Unknown"}</dd></div>
              <div><dt>Transactions</dt><dd className="num">{n(b.txCount)}</dd></div>
              {b.sizeBytes != null && <div><dt>Size</dt><dd className="num">{(b.sizeBytes / 1e6).toFixed(2)} MB · {Math.round(b.fullness * 100)}% of the weight limit</dd></div>}
              <div><dt>Reward</dt><dd className="num">{satsToBtcString(rewardSats)} BTC{feesSats != null ? ` (${subsidy} new + ${satsToBtcString(feesSats)} fees)` : ""}</dd></div>
              {b.previousHash && <div><dt>Previous</dt><dd><Link href={`/block/${b.height - 1}`}>{middleTruncate(b.previousHash, 6)}</Link></dd></div>}
            </dl>
          </details>
          <div className="jr-again"><GhostSearch /></div>
        </section>
      </main>
    </div>
  );
}

function NotFollowable({ kind }: { kind: "not-found" | "invalid" | "error" }) {
  const copy = {
    invalid: { h: "That isn't a block.", p: "Enter a block number (like 903985) or a block hash (64 characters of 0–9 and a–f)." },
    "not-found": { h: "That block doesn't exist yet.", p: "The chain hasn't reached that height, or the hash doesn't match any block." },
    error: { h: "We couldn't look that up right now.", p: "Our data source isn't answering. The link is fine; try again in a minute." },
  }[kind];
  return (
    <div className="st jr">
      <PageHeader back={{ href: "/terminal", label: "Terminal" }} />
      <main id="main" className="pg-frame jr-empty">
        <h1>{copy.h}</h1>
        <p>{copy.p}</p>
        <GhostSearch autoFocus />
      </main>
    </div>
  );
}

function Loading() {
  return (
    <main id="main" className="wrap ev" aria-busy="true">
      <p className="freshline">Looking up the block…</p>
      <div className="skeleton-row" />
      <div className="skeleton-row" />
    </main>
  );
}
