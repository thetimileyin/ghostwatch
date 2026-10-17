import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CopyButton, ShareBar } from "@/components/copy";
import { axisPct } from "@/components/event-bits";
import { ArrowLeftIcon, CheckIcon, ExternalLinkIcon, InfoIcon, WarningIcon } from "@/components/icons";
import { BlockGlyph, SleepField, WakeFlow, halvingsBetween, subsidyAt } from "@/components/story/visuals";
import { ThemeSwitch } from "@/components/theme-switch";
import { Wordmark } from "@/components/wordmark";
import { getEvent, getStatus } from "@/lib/db/read";
import {
  btcShort, dateShort, dateTimeUtc, durationLong, durationShort, heightLabel, isoDate, middleTruncate, monthYear, satsLabel, satsToBtcString,
} from "@/lib/domain/format";
import { blockAt, priceOn } from "@/lib/pulse/history";
import "./story.css";
import { headline, signalGuide, summary } from "@/lib/domain/signal";
import type { FeedStatus, GhostEventDetail } from "@/lib/domain/types";

type Params = Promise<{ id: string }>;
const BASE = (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EXPLORER = "https://mempool.space";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const e = await getEvent(id).catch(() => null);
  if (!e) return { title: "Event not found" };
  const title = `${headline(e)}${e.status === "reversed" ? " (reversed)" : ""}`;
  const description = `${summary(e)} Not proof of a sale, a hack, or who owns it.`;
  return {
    title,
    description,
    alternates: { canonical: `/e/${e.id}` },
    openGraph: { title, description, url: `/e/${e.id}`, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function EventPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<EventSkeleton />}>
      <EventContent params={params} />
    </Suspense>
  );
}

const SCRIPT: Record<string, string> = {
  pubkey: "a pay-to-public-key script (P2PK), the format of Bitcoin's earliest years, which writes the public key itself onto the chain",
  pubkeyhash: "a standard pay-to-public-key-hash address (P2PKH), the classic address starting with 1",
  scripthash: "a pay-to-script-hash address (P2SH), the kind starting with 3",
  witness_v0_keyhash: "a native SegWit address (P2WPKH), starting with bc1q",
  witness_v0_scripthash: "a native SegWit script address (P2WSH)",
  witness_v1_taproot: "a Taproot address (P2TR), starting with bc1p",
  multisig: "a bare multisignature script",
};

const usdFmt = (n: number) => (n < 100 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString("en-US")}`);

async function EventContent({ params }: { params: Params }) {
  await connection();
  const { id } = await params;
  let e: GhostEventDetail | null;
  let status: FeedStatus | null = null;
  try {
    e = await getEvent(id);
    status = await getStatus();
  } catch {
    return <EventUnavailable />;
  }
  if (!e) notFound();

  const url = `${BASE}/e/${e.id}`;
  const guide = signalGuide(e);
  const reversed = e.status === "reversed";
  const counted = e.inputs.filter((i) => i.qualifies).sort((a, b) => a.createdHeight - b.createdHeight);
  const oldest = counted[0] ?? null;
  const newer = e.totalInputCount - e.dormantInputCount;
  const [priceThen, priceAtWake, birthBlock] = await Promise.all([priceOn(e.oldestCreatedTime), priceOn(e.blockTime), blockAt(e.oldestCreatedHeight)]);
  const blocksSlept = e.blockHeight - e.oldestCreatedHeight;
  const halvings = halvingsBetween(e.oldestCreatedHeight, e.blockHeight);
  const rewardThen = subsidyAt(e.oldestCreatedHeight);
  const rewardAtWake = subsidyAt(e.blockHeight);
  const oldestBtc = oldest ? oldest.valueSats / 1e8 : e.dormantSats / 1e8;
  const script = oldest?.scriptType ? SCRIPT[oldest.scriptType] : null;
  const back = e.origin === "archive" ? { href: "/archive", label: "Archive" } : { href: "/feed", label: "Ghost feed" };
  const n = (x: number) => x.toLocaleString("en-US");

  return (
    <div className="st">
      <header className="st-top">
        <div className="st-frame st-top-in">
          <Link href="/" className="brand" aria-label="GhostWatch home">
            <Wordmark />
            <span className="wordmark">Ghost<span>Watch</span></span>
          </Link>
          <Link href={back.href} className="st-back"><ArrowLeftIcon aria-hidden /> {back.label}</Link>
          <ThemeSwitch />
        </div>
      </header>

      <main id="main" className="st-frame">
        {reversed && (
          <div className="banner banner--bad" role="status">
            <WarningIcon aria-hidden />
            <div>
              <strong>This event was reversed.</strong>
              <p>The block that contained it was replaced by a chain reorganization. The story below describes a transaction that is no longer confirmed.</p>
            </div>
          </div>
        )}

        {/* Opening */}
        <section className="st-hero" aria-labelledby="st-h">
          <p className="st-kicker">[ Event {e.id} ] · {e.origin === "archive" ? "From the archive" : "Seen live"}</p>
          <h1 id="st-h">
            <span className="num">{btcShort(e.dormantSats)}</span> slept for {durationLong(e.oldestCreatedTime, e.blockTime)}.
            <br />
            <span className="dim">Then, on {dateShort(e.blockTime)}, it moved.</span>
          </h1>
          <div className="st-span" role="img" aria-label={`From ${monthYear(e.oldestCreatedTime)} to ${monthYear(e.blockTime)}`}>
            <div className="st-span-bar"><i style={{ left: `${axisPct(e.oldestCreatedTime, e.blockTime)}%` }} /></div>
            <div className="st-span-ends">
              <span>{monthYear(e.oldestCreatedTime)}<em>created</em></span>
              <span>{monthYear(e.blockTime)}<em>moved</em></span>
            </div>
          </div>
          <p className="st-scroll">Scroll to follow the coins</p>
        </section>

        {/* 01 */}
        <section className="st-ch" aria-labelledby="ch1">
          <div className="st-ch-text">
            <p className="st-idx">[01] The arrival</p>
            <h2 id="ch1">{dateShort(e.oldestCreatedTime)}. Block {heightLabel(e.oldestCreatedHeight)}.</h2>
            <p>
              A new output appeared on the chain holding <b className="num">{satsToBtcString(Math.round(oldestBtc * 1e8))} BTC</b>
              {counted.length > 1 ? `, the oldest of the ${counted.length} old outputs in this story` : ""}.
              {script ? <> It was locked with {script}.</> : null}
            </p>
            <p>
              Back then, every new block paid its miner <b className="num">{rewardThen} BTC</b>.{" "}
              {priceThen != null ? (
                <>One bitcoin traded for about <b className="num">{usdFmt(priceThen)}</b>, so this output was worth roughly <b className="num">{usdFmt(oldestBtc * priceThen)}</b>.</>
              ) : (
                <>There is no reliable market price for bitcoin on that date.</>
              )}
            </p>
          </div>
          <BlockGlyph height={e.oldestCreatedHeight} value={oldest ? oldest.valueSats : e.dormantSats} txCount={birthBlock?.txCount ?? null} fullness={birthBlock?.fullness ?? null} scriptType={oldest?.scriptType ?? null} />
        </section>

        {/* 02 */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch2">
          <div className="st-ch-text">
            <p className="st-idx">[02] The long sleep</p>
            <h2 id="ch2">Then nothing touched it for {durationLong(e.oldestCreatedTime, e.blockTime)}.</h2>
            <p>
              While it waited, miners added <b className="num">{n(blocksSlept)}</b> blocks on top of it
              {halvings.length > 0 ? <>, and the reward for each block was cut in half <b className="num">{halvings.length}</b> time{halvings.length === 1 ? "" : "s"}, from {rewardThen} BTC to {rewardAtWake} BTC</> : null}.
              The output never moved.
            </p>
          </div>
          <SleepField from={e.oldestCreatedHeight} to={e.blockHeight} />
          <dl className="st-readouts">
            <div><dt>Blocks passed</dt><dd className="num">{n(blocksSlept)}</dd></div>
            <div><dt>Halvings slept through</dt><dd className="num">{halvings.length}</dd></div>
            <div><dt>Days unspent</dt><dd className="num">{n(Math.floor(e.maxAgeSeconds / 86400))}</dd></div>
          </dl>
        </section>

        {/* 03 */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch3">
          <div className="st-ch-text">
            <p className="st-idx">[03] The waking</p>
            <h2 id="ch3">{dateTimeUtc(e.blockTime)}. Block {heightLabel(e.blockHeight)}.</h2>
            <p>
              A transaction spent it.{" "}
              {e.dormantInputCount > 1 ? (
                <><b className="num">{e.dormantInputCount}</b> of its {e.totalInputCount} inputs had been unspent for five years or more, together holding <b className="num">{satsToBtcString(e.dormantSats)} BTC</b>.</>
              ) : (
                <>It carried <b className="num">{satsToBtcString(e.dormantSats)} BTC</b> of coins unspent for five years or more.</>
              )}
              {newer > 0 ? <> The other {newer} input{newer === 1 ? " was" : "s were"} newer and {newer === 1 ? "isn't" : "aren't"} counted.</> : null}{" "}
              Everything went out to {e.outputCount} output{e.outputCount === 1 ? "" : "s"}.
            </p>
            {priceAtWake != null && (
              <p>
                At that moment one bitcoin traded for about <b className="num">{usdFmt(priceAtWake)}</b>, putting the old coins at roughly <b className="num">{usdFmt((e.dormantSats / 1e8) * priceAtWake)}</b>
                {priceThen != null && priceAtWake > priceThen ? <>, {n(Math.round(priceAtWake / priceThen))} times the price on the day the oldest of them arrived</> : null}.
              </p>
            )}
          </div>
          <WakeFlow inputs={e.inputs} outputCount={e.outputCount} />
        </section>

        {/* 04 */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch4">
          <div className="st-ch-text">
            <p className="st-idx">[04] What it means</p>
            <h2 id="ch4">The chain shows what happened. Not why.</h2>
          </div>
          <div className="st-guide">
            <div className="st-g">
              <h3><CheckIcon aria-hidden /> What we saw</h3>
              <ul>{guide.observed.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div className="st-g">
              <h3><InfoIcon aria-hidden /> What it might mean</h3>
              <ul>{guide.possible.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div className="st-g st-g--not">
              <h3><WarningIcon aria-hidden /> What it doesn&apos;t prove</h3>
              <ul>{guide.notProof.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>
        </section>

        {/* 05 */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch5">
          <div className="st-ch-text">
            <p className="st-idx">[05] Check it yourself</p>
            <h2 id="ch5">Don&apos;t trust this page. Verify it.</h2>
            <p>Everything above comes from public block data. Open the transaction and the block on a block explorer, or on your own node.</p>
          </div>
          <div className="st-verify">
            <a href={`${EXPLORER}/tx/${e.txid}`} target="_blank" rel="noopener noreferrer" className="st-btn st-btn--primary">Transaction on mempool.space <ExternalLinkIcon aria-hidden /></a>
            <a href={`${EXPLORER}/block/${e.blockHash}`} target="_blank" rel="noopener noreferrer" className="st-btn">Block {heightLabel(e.blockHeight)} <ExternalLinkIcon aria-hidden /></a>
          </div>
          <ShareBar url={url} text={`${headline(e)}.`} />

          <details className="st-details">
            <summary>Full evidence: transaction, inputs and method</summary>
            <dl className="ledger">
              <div>
                <dt>Transaction</dt>
                <dd><span className="hash"><code title={e.txid}>{e.txid}</code><CopyButton value={e.txid} label="Copy transaction ID" toast="Transaction ID copied" /></span></dd>
              </div>
              <div><dt>Block</dt><dd>{heightLabel(e.blockHeight)} · <span title={e.blockHash}>{middleTruncate(e.blockHash, 6)}</span></dd></div>
              <div><dt>Dormant amount</dt><dd className="num">{satsToBtcString(e.dormantSats)} BTC · {satsLabel(e.dormantSats)}</dd></div>
              <div><dt>Oldest output</dt><dd>block {heightLabel(e.oldestCreatedHeight)} · {dateTimeUtc(e.oldestCreatedTime)}</dd></div>
              <div><dt>Inputs counted</dt><dd>{e.dormantInputCount} of {e.totalInputCount}</dd></div>
              <div>
                <dt>How age is measured</dt>
                <dd className="prose">For each output spent, we subtract the time of the block that created it from the time of the block that spent it. Ages are per output, not per wallet. Outputs younger than five years are listed but not counted. Prices are daily USD averages from mempool.space.</dd>
              </div>
              <div><dt>Permalink</dt><dd><span className="hash"><code>{url.replace(/^https?:\/\//, "")}</code><CopyButton value={url} label="Copy link to this event" toast="Link copied" kind="link" /></span></dd></div>
            </dl>
            <div className="inputs-wrap" tabIndex={0} role="region" aria-label="Inputs of the transaction">
              <table className="inputs">
                <thead><tr><th scope="col">Created (oldest first)</th><th scope="col">Unspent for</th><th scope="col">BTC</th></tr></thead>
                <tbody>
                  {[...e.inputs].sort((a, b) => a.createdHeight - b.createdHeight).map((i) => (
                    <tr key={i.inputIndex} data-q={String(i.qualifies)}>
                      <td>{i.createdTime > 0 ? isoDate(i.createdTime) : `block ${heightLabel(i.createdHeight)}`}</td>
                      <td>{i.createdTime > 0 ? durationShort(i.createdTime, e.blockTime) : "< 5y"}</td>
                      <td className="num">{satsToBtcString(i.valueSats)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {e.history.length > 1 && (
              <ol className="history">
                {e.history.map((h, i) => (
                  <li key={i}>
                    <span>{dateTimeUtc(Date.parse(h.at) / 1000)}</span>
                    {h.fromStatus && <s>{h.fromStatus}</s>}
                    <span className={h.toStatus === "reversed" ? "pill pill--bad" : "pill pill--ok"}>{h.toStatus}</span>
                    {h.note && <span>{h.note}</span>}
                  </li>
                ))}
              </ol>
            )}
            <p className="note">Detected {dateTimeUtc(Date.parse(e.detectedAt) / 1000)} · {btcShort(e.dormantSats)} · event {e.id}{status?.lastProcessedHeight ? ` · chain checked to block ${heightLabel(status.lastProcessedHeight)}` : ""}</p>
          </details>
        </section>
      </main>
    </div>
  );
}

function EventSkeleton() {
  return (
    <main id="main" className="wrap ev" aria-busy="true">
      <p className="freshline">Loading event…</p>
      <div className="skeleton-row" />
      <div className="skeleton-row" />
    </main>
  );
}

function EventUnavailable() {
  return (
    <main id="main" className="wrap ev">
      <div className="state state--error" role="alert">
        <h3>This event can&apos;t be loaded right now.</h3>
        <p>The link is fine; our data is temporarily unreachable. Try again in a minute.</p>
      </div>
    </main>
  );
}
