import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy";
import { ArrowRightIcon, CheckIcon, ExternalLinkIcon, InfoIcon, WarningIcon } from "@/components/icons";
import { AgeBreakdown } from "@/components/journey-bits";
import { PageHeader } from "@/components/page-header";
import { GhostSearch } from "@/components/tx-search";
import { WatchButton } from "@/components/watch";
import { ageCompact, amountWords, dateShort, middleTruncate, monthYear, satsToBtcString, spanWords } from "@/lib/domain/format";
import { SCRIPT, SCRIPT_TAG } from "@/lib/domain/scripts";
import { addressType, normalizeAddress, type KeyExposure } from "@/lib/journey/address";
import { getAddressStory } from "@/lib/journey/address-server";
import { priceOnDay } from "@/lib/pulse/prices";
import { getPriceHistory } from "@/lib/pulse/price-server";
import { getPulse } from "@/lib/pulse/server";
import "../../e/[id]/story.css";
import "../../tx/[txid]/journey.css";

type Params = Promise<{ addr: string }>;
const EXPLORER = "https://mempool.space";
const SHOW = 12;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { addr } = await params;
  const a = decodeURIComponent(addr);
  return {
    title: addressType(a) ? `Address ${middleTruncate(normalizeAddress(a), 6)}` : "Address",
    description: "What this address holds, how old those coins are, what came and went, and whether its key is visible on the chain.",
    robots: { index: false },
  };
}

export default function AddressPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Loading />}>
      <AddressContent params={params} />
    </Suspense>
  );
}

const usd = (n: number) => (n < 0.01 ? "under a cent" : n < 100 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString("en-US")}`);
const n = (x: number) => x.toLocaleString("en-US");
/** ", about $1,234" when there's a price and it's at least a cent; otherwise nothing. */
const aboutUsd = (sats: number, price: number | null) => (price != null && (sats / 1e8) * price >= 0.01 ? `, about ${usd((sats / 1e8) * price)}` : "");
const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${k === 1 ? one : many}`;

async function AddressContent({ params }: { params: Params }) {
  await connection();
  const { addr } = await params;
  const r = await getAddressStory(decodeURIComponent(addr));
  if (r.kind !== "ok") return <NotFollowable kind={r.kind} />;
  const s = r.story;
  const [hist, pulse] = await Promise.all([getPriceHistory().catch(() => null), getPulse().catch(() => null)]);
  const now = Math.floor(Date.now() / 1000);
  const price = pulse?.priceUsd ?? null;
  const dated = (s.coins ?? []).filter((c) => c.arrivedTime != null).sort((a, b) => a.arrivedTime! - b.arrivedTime!);
  const oldest = dated[0] ?? null;
  const firstUse = s.historyComplete ? [...s.recent].reverse().find((t) => t.time != null) ?? null : null;
  const tag = SCRIPT_TAG[s.type] ?? "Address";

  return (
    <div className="st jr">
      <PageHeader back={{ href: "/terminal", label: "Terminal" }} />
      <main id="main" className="pg-frame">
        <section className="st-hero" aria-labelledby="ad-h">
          <p className="st-kicker">[ Address {middleTruncate(s.address, 6)} ] · {tag}</p>
          <h1 id="ad-h">
            {s.balanceSats > 0 ? (
              <>
                <span className="num">{amountWords(s.balanceSats)}</span> sits at this address.
                <br />
                <span className="dim">
                  {s.coins
                    ? oldest
                      ? s.coins.length === 1
                        ? `1 coin, here since ${monthYear(oldest.arrivedTime!)}.`
                        : `${plural(s.coins.length, "coin")}, the oldest here since ${monthYear(oldest.arrivedTime!)}.`
                      : `${plural(s.coins.length, "coin")}.`
                    : "Spread over more coins than we can list."}
                </span>
              </>
            ) : (
              <>
                This address is empty.
                <br />
                <span className="dim">Every coin it received has moved on.</span>
              </>
            )}
          </h1>
          <WatchButton kind="address" id={s.address} label={`Address ${middleTruncate(s.address, 6)}`} />
          <p className="jr-lede">
            An address is a label coins can be sent to. It isn&apos;t a person or a wallet: one wallet can use thousands of addresses, and coins at
            one address can belong to anyone who holds its key.
          </p>
        </section>

        {/* 01 */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch1">
          <div className="st-ch-text">
            <p className="st-idx">[01] What it holds</p>
            {s.balanceSats === 0 ? (
              <h2 id="ch1">Nothing right now.</h2>
            ) : s.coins ? (
              <>
                <h2 id="ch1">{plural(s.coins.length, "coin")} worth {amountWords(s.balanceSats)}{aboutUsd(s.balanceSats, price)}.</h2>
                {oldest && (
                  <p>
                    {s.coins.length > 1 ? "The oldest" : "It"} arrived on <b>{dateShort(oldest.arrivedTime!)}</b> and has sat here for {spanWords(oldest.arrivedTime!, now)}
                    {(() => {
                      const p = priceOnDay(hist, oldest.arrivedTime!);
                      return p != null ? <>. One bitcoin was about <b className="num">{usd(p)}</b> then</> : null;
                    })()}
                    .
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 id="ch1">{amountWords(s.balanceSats)}{aboutUsd(s.balanceSats, price)}.</h2>
                <p>This address holds more than 500 separate coins, too many to list one by one. Its totals and recent activity are below.</p>
              </>
            )}
            {s.pendingSats !== 0 && (
              <p>
                {s.pendingSats > 0 ? <><b className="num">{amountWords(s.pendingSats)}</b> more is on its way</> : <><b className="num">{amountWords(-s.pendingSats)}</b> is on its way out</>}, waiting to be confirmed.
              </p>
            )}
          </div>
          {s.coins && s.coins.length > 0 && (
            <>
              <AgeBreakdown coins={s.coins.map((c) => ({ valueSats: c.valueSats, time: c.arrivedTime }))} at={now} label="How long its coins have sat here" />
              <div className="jr-list">
                <h3 className="jr-list-h">The coins it holds{s.coins.length > SHOW ? ` · largest ${SHOW} of ${n(s.coins.length)}` : ""}</h3>
                <ol>
                  {s.coins.slice(0, SHOW).map((c) => (
                    <li key={`${c.txid}:${c.vout}`} className="jr-row">
                      <span className="jr-amt num">{satsToBtcString(c.valueSats)} BTC</span>
                      <span className="jr-what">{c.arrivedTime != null ? <>arrived {dateShort(c.arrivedTime)} · here {ageCompact(c.arrivedTime, now)}</> : "arriving: still waiting to be confirmed"}</span>
                      <Link href={`/tx/${c.txid}`} className="jr-follow" aria-label="Follow this coin back to the transaction that brought it">Arrived in <ArrowRightIcon aria-hidden /></Link>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </section>

        {/* 02 */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch2">
          <div className="st-ch-text">
            <p className="st-idx">[02] Its history</p>
            <h2 id="ch2">It has received {plural(s.receivedCount, "coin")} and sent {plural(s.spentCount, "coin")} on.</h2>
            <p>
              In total <b className="num">{amountWords(s.receivedSats)}</b> came in and <b className="num">{amountWords(s.sentSats)}</b> went out, across {plural(s.txCount, "transaction")}.
              {firstUse?.time ? <> It was first used on <b>{dateShort(firstUse.time)}</b>.</> : null}
            </p>
          </div>
          {s.recent.length > 0 && (
            <div className="jr-list">
              <h3 className="jr-list-h">Most recent activity{s.txCount > SHOW ? ` · latest ${Math.min(SHOW, s.recent.length)} of ${n(s.txCount)}` : ""}</h3>
              <ol>
                {s.recent.slice(0, SHOW).map((t) => (
                  <li key={t.txid} className="jr-row">
                    <span className="jr-amt num">{t.netSats > 0 ? "+" : t.netSats < 0 ? "−" : ""}{satsToBtcString(Math.abs(t.netSats))} BTC</span>
                    <span className="jr-what">
                      {t.netSats > 0 ? "received" : t.netSats < 0 ? "sent" : "moved between its own coins"} · {t.time != null ? dateShort(t.time) : "waiting to be confirmed"}
                    </span>
                    <Link href={`/tx/${t.txid}`} className="jr-follow" aria-label="Follow this transaction">Follow <ArrowRightIcon aria-hidden /></Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        {/* 03 */}
        <section className="st-ch" aria-labelledby="ch3">
          <div className="st-ch-text">
            <p className="st-idx">[03] Is its key on the chain?</p>
            <KeyCopy k={s.key} />
            <p>
              A public key on the chain is safe today: no one can spend from it. It would only matter if large quantum computers become able to
              work backwards from a public key to the private key. Coins whose key is still hidden behind a hash have one more layer of protection
              until they move.
            </p>
          </div>
        </section>

        {/* 04 */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch4">
          <div className="st-ch-text">
            <p className="st-idx">[04] What it means</p>
            <h2 id="ch4">The chain shows coins, not owners.</h2>
          </div>
          <div className="st-guide">
            <div className="st-g">
              <h3><CheckIcon aria-hidden /> What we saw</h3>
              <ul>
                <li>{s.balanceSats > 0 ? `It holds ${amountWords(s.balanceSats)}.` : "It holds nothing right now."}</li>
                <li>It was used in {plural(s.txCount, "transaction")}.</li>
                {SCRIPT[s.type] && <li>It is {SCRIPT[s.type]}.</li>}
              </ul>
            </div>
            <div className="st-g">
              <h3><InfoIcon aria-hidden /> What it might be</h3>
              <ul>
                {s.txCount > 1000 ? <li>Thousands of transactions usually means an exchange, a service or a well-known address people send to.</li> : <li>A personal wallet, a service, or anything in between.</li>}
                {s.txCount > 1 ? <li>Using one address again and again makes its history easy to follow. Most wallets use a new address each time.</li> : null}
              </ul>
            </div>
            <div className="st-g st-g--not">
              <h3><WarningIcon aria-hidden /> What it doesn&apos;t prove</h3>
              <ul>
                <li>Who controls it. Addresses aren&apos;t names.</li>
                <li>That it&apos;s one person&apos;s whole balance. Wallets spread coins over many addresses.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 05 */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch5">
          <div className="st-ch-text">
            <p className="st-idx">[05] Check it yourself</p>
            <h2 id="ch5">Don&apos;t trust this page. Verify it.</h2>
            <p>Everything here comes from public block data. Looking it up here doesn&apos;t tie the address to you: our server fetched it, and nothing you search is stored.</p>
          </div>
          <div className="st-verify">
            <a href={`${EXPLORER}/address/${s.address}`} target="_blank" rel="noopener noreferrer" className="st-btn st-btn--primary">Address on mempool.space <ExternalLinkIcon aria-hidden /></a>
          </div>
          <details className="st-details">
            <summary>Full details</summary>
            <dl className="ledger">
              <div><dt>Address</dt><dd><span className="hash"><code title={s.address}>{s.address}</code><CopyButton value={s.address} label="Copy address" toast="Address copied" /></span></dd></div>
              <div><dt>Type</dt><dd>{tag}</dd></div>
              <div><dt>Balance</dt><dd className="num">{satsToBtcString(s.balanceSats)} BTC</dd></div>
              <div><dt>Received</dt><dd className="num">{satsToBtcString(s.receivedSats)} BTC in {n(s.receivedCount)} coins</dd></div>
              <div><dt>Sent</dt><dd className="num">{satsToBtcString(s.sentSats)} BTC from {n(s.spentCount)} coins</dd></div>
              <div><dt>Transactions</dt><dd className="num">{n(s.txCount)}</dd></div>
            </dl>
          </details>
          <div className="jr-again"><GhostSearch /></div>
        </section>
      </main>
    </div>
  );
}

function KeyCopy({ k }: { k: KeyExposure }) {
  const copy = {
    taproot: { h: "Yes, by design.", p: "Taproot addresses put the public key itself on the chain, so it has been visible since the first coin arrived." },
    spent: { h: "Yes. It has sent coins before.", p: "Spending from an address reveals its public key, and this one has spent. Any coins still here share that visible key." },
    "never-spent": { h: "No. Only a hash of the key is public.", p: "This address has never sent coins, so its public key hasn't been revealed. That changes the first time it spends." },
    script: { h: "Not yet.", p: "This is a script address. Its script, and any keys inside it, stay hidden until it spends for the first time." },
  }[k.why];
  return (
    <>
      <h2 id="ch3">{copy.h}</h2>
      <p>{copy.p}</p>
    </>
  );
}

function NotFollowable({ kind }: { kind: "invalid" | "error" }) {
  const copy =
    kind === "invalid"
      ? { h: "That isn't a Bitcoin address.", p: "Bitcoin addresses start with 1, 3 or bc1. Copy it whole from the wallet or explorer it came from." }
      : { h: "We couldn't look that up right now.", p: "Our data source isn't answering. The link is fine; try again in a minute." };
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
      <p className="freshline">Looking up the address…</p>
      <div className="skeleton-row" />
      <div className="skeleton-row" />
    </main>
  );
}

