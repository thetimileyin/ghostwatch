import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy";
import { axisPct } from "@/components/event-bits";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ExternalLinkIcon, InfoIcon, WarningIcon } from "@/components/icons";
import { AgeBreakdown } from "@/components/journey-bits";
import { PageHeader } from "@/components/page-header";
import { BlockGlyph, WakeFlow } from "@/components/story/visuals";
import { GhostSearch } from "@/components/tx-search";
import { WatchButton } from "@/components/watch";
import { SCRIPT, SCRIPT_TAG } from "@/lib/domain/scripts";
import { ageCompact, ago, amountWords, dateShort, dateTimeUtc, heightLabel, isoDate, middleTruncate, monthYear, satsToBtcString, spanWords } from "@/lib/domain/format";
import type { GhostInput } from "@/lib/domain/types";
import { ageBucket, feeVsTypical, isTxid, type Journey, type JourneyInput, type JourneyOutput } from "@/lib/journey/journey";
import { getJourney, type BlockInfo } from "@/lib/journey/server";
import { priceOnDay } from "@/lib/pulse/prices";
import { getPriceHistory } from "@/lib/pulse/price-server";
import { getPulse } from "@/lib/pulse/server";
import "../../e/[id]/story.css";
import "./journey.css";

type Params = Promise<{ txid: string }>;
const EXPLORER = "https://mempool.space";
const SHOW = 12; // inputs/outputs listed in the story; the rest are in the full details

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { txid } = await params;
  const short = isTxid(txid) ? middleTruncate(txid.toLowerCase(), 6) : "Transaction";
  return {
    title: `Transaction ${short}`,
    description: "Where these coins came from, where they went, what it cost, and which block it landed in.",
    robots: { index: false }, // one page per transaction: don't fill search engines with them
  };
}

export default function TxPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Loading />}>
      <TxContent params={params} />
    </Suspense>
  );
}

const usd = (n: number) => (n < 0.01 ? "under a cent" : n < 100 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString("en-US")}`);
const n = (x: number) => x.toLocaleString("en-US");
const btc = (sats: number) => `${satsToBtcString(sats)} BTC`; // exact, for lists and details
const amt = amountWords; // rounded (or sats when small), for headings and sentences
const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${k === 1 ? one : many}`;


async function TxContent({ params }: { params: Params }) {
  await connection();
  const { txid } = await params;
  const r = await getJourney(txid);
  if (r.kind === "block") redirect(`/block/${r.hash}`);
  if (r.kind !== "ok") return <NotFollowable kind={r.kind} />;

  const { journey: j, block, eventId, firstSeen, tip } = r;
  const [hist, pulse] = await Promise.all([getPriceHistory().catch(() => null), getPulse().catch(() => null)]);
  const now = Math.floor(Date.now() / 1000);
  const at = j.blockTime ?? now; // when it happened (or now, while it waits)
  const priceAt = j.blockTime ? priceOnDay(hist, j.blockTime) : (pulse?.priceUsd ?? null);

  const dated = j.inputs.filter((i) => i.createdTime != null).sort((a, b) => a.createdTime! - b.createdTime!);
  const oldest = dated[0] ?? null;
  const newest = dated[dated.length - 1] ?? null;
  const dormant = j.inputs.filter((i) => i.dormant);
  const payments = j.outputs.filter((o) => o.kind === "payment");
  const change = j.outputs.filter((o) => o.kind === "change");
  const notes = j.outputs.filter((o) => o.kind === "data");
  const sentSats = payments.reduce((s, o) => s + o.valueSats, 0);
  const headlineSats = j.coinbase ? j.totalOutSats : sentSats || j.totalOutSats;
  const from = oldest?.createdTime ?? at;

  return (
    <div className="st jr">
      <PageHeader back={{ href: "/terminal", label: "Terminal" }} />
      <main id="main" className="pg-frame">
        {/* Opening */}
        <section className="st-hero" aria-labelledby="jr-h">
          <p className="st-kicker">
            [ Transaction {middleTruncate(j.txid, 6)} ] · {j.coinbase ? "New coins" : j.confirmed ? "Confirmed" : "Waiting to be confirmed"}
          </p>
          <h1 id="jr-h">
            {j.coinbase ? (
              <>
                <span className="num">{amt(j.totalOutSats)}</span> of brand-new bitcoin.
                <br />
                <span className="dim">A miner created it as the reward for block {j.blockHeight != null ? heightLabel(j.blockHeight) : ""}.</span>
              </>
            ) : j.confirmed ? (
              <>
                <span className="num">{amt(headlineSats)}</span> moved on {dateShort(at)}.
                <br />
                <span className="dim">Here&apos;s where it came from, and where it went.</span>
              </>
            ) : (
              <>
                <span className="num">{amt(headlineSats)}</span> is on its way.
                <br />
                <span className="dim">It&apos;s waiting for a miner to put it in a block.</span>
              </>
            )}
          </h1>
          {!j.coinbase && oldest && (
            <div className="st-span" role="img" aria-label={`Oldest coin from ${monthYear(from)}, moved ${monthYear(at)}`}>
              <div className="st-span-bar"><i style={{ left: `${axisPct(from, at)}%` }} /></div>
              <div className="st-span-ends">
                <span>{monthYear(from)}<em>oldest coin created</em></span>
                <span>{j.confirmed ? monthYear(at) : "Now"}<em>{j.confirmed ? "moved" : "waiting"}</em></span>
              </div>
            </div>
          )}
          {!j.coinbase && <WatchButton kind="tx" id={j.txid} label={`Transaction ${middleTruncate(j.txid, 6)}`} confirmed={j.confirmed} />}
          <p className="jr-lede">
            Bitcoin doesn&apos;t move as balances. It moves as separate coins: a transaction spends whole coins and creates new ones. Follow any coin
            backwards to where it came from, or forwards to where it went next.
          </p>
        </section>

        {/* 01: where the coins came from */}
        {j.coinbase ? (
          <section className="st-ch" aria-labelledby="ch1">
            <div className="st-ch-text">
              <p className="st-idx">[01] Where the coins came from</p>
              <h2 id="ch1">Nowhere. This is where new bitcoin begins.</h2>
              <p>
                The first transaction in every block pays the miner who built it: a fixed reward of newly created bitcoin plus the fees from every
                other transaction in the block. It spends no older coins, so this journey starts here.
              </p>
              {priceAt != null && <p>At the time, that was worth about <b className="num">{usd((j.totalOutSats / 1e8) * priceAt)}</b>.</p>}
            </div>
          </section>
        ) : (
          <section className="st-ch st-ch--wide" aria-labelledby="ch1">
            <div className="st-ch-text">
              <p className="st-idx">[01] Where the coins came from</p>
              <h2 id="ch1">It spent {plural(j.inputs.length, "coin")} holding {amt(j.totalInSats)}.</h2>
              {oldest?.createdTime != null && (
                <p>
                  {j.inputs.length > 1 ? "The oldest" : "It"} was created on <b>{dateShort(oldest.createdTime)}</b>, {spanWords(oldest.createdTime, at)} before
                  {j.confirmed ? " this transaction" : " now"}
                  {(() => {
                    const p = priceOnDay(hist, oldest.createdTime);
                    return p != null ? <>, when one bitcoin was about <b className="num">{usd(p)}</b></> : null;
                  })()}
                  .{newest && newest !== oldest && newest.createdTime != null ? <> The newest was created {spanWords(newest.createdTime, at)} before.</> : null}
                </p>
              )}
              {j.inputs.some((i) => i.createdTime == null) && (
                <p>{plural(j.inputs.filter((i) => i.createdTime == null).length, "coin")} came from a transaction that is itself still waiting, so it has no date yet.</p>
              )}
              {j.inputs.some((i) => i.minerReward) && <p>{plural(j.inputs.filter((i) => i.minerReward).length, "coin")} started life as a miner&apos;s reward.</p>}
            </div>
            <AgeBreakdown coins={j.inputs.map((i) => ({ valueSats: i.valueSats, time: i.createdTime }))} at={at} label="How old the spent coins were" />
            <CoinList title="The coins it spent" items={[...j.inputs].sort((a, b) => b.valueSats - a.valueSats).slice(0, SHOW)} total={j.inputs.length} at={at} />
          </section>
        )}

        {/* 02: where they went */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch2">
          <div className="st-ch-text">
            <p className="st-idx">[02] Where they went</p>
            <h2 id="ch2">{wentHeadline(payments.length, change.length, notes.length, j.coinbase)}</h2>
            <p>
              {j.coinbase
                ? "The reward went to the miner's chosen address."
                : change.length > 0
                  ? "Coins go back to the sender when the coins spent were bigger than the amount being sent, like change from a note."
                  : "We only call something change when coins go back to the exact same address. Wallets usually send change to a fresh address, so one of these may be change too."}
              {notes.length > 0 ? " A note (OP_RETURN) holds a little data and no bitcoin." : ""}
            </p>
          </div>
          {!j.coinbase && <WakeFlow inputs={j.inputs.map(asGhostInput)} outputCount={j.outputs.length} />}
          <OutList items={j.outputs.slice(0, SHOW)} total={j.outputs.length} price={priceAt} />
        </section>

        {/* 03: the fee and the wait */}
        {!j.coinbase && j.feeSats != null && (
          <section className="st-ch" aria-labelledby="ch3">
            <div className="st-ch-text">
              <p className="st-idx">[03] The fee</p>
              <h2 id="ch3">
                {j.confirmed ? "It paid" : "It's offering"} {n(j.feeSats)} sats{priceAt != null ? ` (${usd((j.feeSats / 1e8) * priceAt)})` : ""} to get in.
              </h2>
              <p>
                Miners pick transactions by fee per unit of space. This one {j.confirmed ? "paid" : "offers"} <b className="num">{j.feeRate!.toFixed(1)} sat/vB</b>
                {j.confirmed && block?.medianFee ? (
                  <>, {feeVsTypical(j.feeRate!, block.medianFee)} the typical <b className="num">{block.medianFee.toFixed(1)} sat/vB</b> paid in its block</>
                ) : null}
                . That&apos;s <b className="num">{feeShare(j.feeSats, j.totalInSats)}</b> of the coins it spent.
              </p>
              {!j.confirmed && <WaitOutlook rate={j.feeRate!} fees={pulse?.fees ?? null} firstSeen={firstSeen} now={now} />}
            </div>
          </section>
        )}

        {/* 04: into a block */}
        <section className="st-ch" aria-labelledby="ch4">
          <div className="st-ch-text">
            <p className="st-idx">[04] {j.confirmed ? "Into a block" : "Not in a block yet"}</p>
            {j.confirmed && j.blockHeight != null ? (
              <>
                <h2 id="ch4">{dateTimeUtc(at)}. <Link href={`/block/${j.blockHeight}`} className="jr-h-link">Block {heightLabel(j.blockHeight)}</Link>.</h2>
                <p>
                  {block?.pool ? <>Mined by <b>{block.pool}</b>. </> : null}
                  {block ? <>The block held <b className="num">{n(block.txCount)}</b> transactions and was {Math.round(block.fullness * 100)}% full. </> : null}
                  {j.confirmations > 1 ? (
                    <>Since then, <b className="num">{n(j.confirmations - 1)}</b> more block{j.confirmations - 1 === 1 ? " has" : "s have"} been added on top, over the past {spanWords(at, now)}. Each one makes this transaction harder to undo.</>
                  ) : (
                    <>It&apos;s in the newest block. Each block added on top makes it harder to undo.</>
                  )}
                </p>
              </>
            ) : (
              <>
                <h2 id="ch4">It&apos;s in the queue with everything else waiting.</h2>
                <p>Until a miner includes it in a block, it isn&apos;t final. This page updates when you reload it.</p>
              </>
            )}
          </div>
          {j.confirmed && j.blockHeight != null && (
            <BlockGlyph height={j.blockHeight} value={j.totalOutSats} txCount={block?.txCount ?? null} fullness={block?.fullness ?? null} scriptType={null} mark="this transaction" valueLabel="moved" />
          )}
        </section>

        {/* 05: what it means */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch5">
          <div className="st-ch-text">
            <p className="st-idx">[05] What it means</p>
            <h2 id="ch5">The chain shows what moved. Not who, and not why.</h2>
            {dormant.length > 0 && (
              <div className="jr-wake">
                <p>
                  <b>Old coins woke up.</b> {plural(dormant.length, "coin")} holding <b className="num">{amt(dormant.reduce((s, i) => s + i.valueSats, 0))}</b> had
                  been unspent for five years or more.
                </p>
                {eventId ? (
                  <Link href={`/e/${eventId}`} className="st-btn st-btn--primary">Read the full story <ArrowRightIcon aria-hidden /></Link>
                ) : (
                  <p className="jr-muted">GhostWatch doesn&apos;t have a story page for this one: it isn&apos;t in our feed or archive.</p>
                )}
              </div>
            )}
          </div>
          <div className="st-guide">
            <div className="st-g">
              <h3><CheckIcon aria-hidden /> What we saw</h3>
              <ul>
                <li>{j.coinbase ? "New bitcoin was created as a block reward." : `${plural(j.inputs.length, "coin")} ${j.inputs.length === 1 ? "was" : "were"} spent and ${plural(j.outputs.length, "new coin")} created.`}</li>
                {j.confirmed && j.blockHeight != null && <li>It was confirmed in block {heightLabel(j.blockHeight)}.</li>}
                {dormant.length > 0 && <li>Some of the coins had not moved for five years or more.</li>}
              </ul>
            </div>
            <div className="st-g">
              <h3><InfoIcon aria-hidden /> What it might be</h3>
              <ul>
                {j.coinbase ? (
                  <li>A miner or mining pool collecting its reward.</li>
                ) : (
                  <>
                    <li>A payment, a move between someone&apos;s own wallets, or a service tidying up its coins.</li>
                    {j.inputs.length >= 10 && j.outputs.length <= 2 ? <li>Many coins into one or two is often a wallet consolidating.</li> : null}
                    {j.outputs.length >= 10 ? <li>One transaction to many outputs is often an exchange or service paying out.</li> : null}
                  </>
                )}
              </ul>
            </div>
            <div className="st-g st-g--not">
              <h3><WarningIcon aria-hidden /> What it doesn&apos;t prove</h3>
              <ul>
                <li>Who sent or received anything. Addresses aren&apos;t names.</li>
                <li>That it was a sale or a purchase.</li>
                {!j.coinbase && <li>Which output is change, unless it went back to the same address.</li>}
              </ul>
            </div>
          </div>
        </section>

        {/* 06: verify */}
        <section className="st-ch st-ch--wide" aria-labelledby="ch6">
          <div className="st-ch-text">
            <p className="st-idx">[06] Check it yourself</p>
            <h2 id="ch6">Don&apos;t trust this page. Verify it.</h2>
            <p>Everything here comes from public block data. Open it on a block explorer, or on your own node.</p>
          </div>
          <div className="st-verify">
            <a href={`${EXPLORER}/tx/${j.txid}`} target="_blank" rel="noopener noreferrer" className="st-btn st-btn--primary">Transaction on mempool.space <ExternalLinkIcon aria-hidden /></a>
            {j.blockHash && j.blockHeight != null && (
              <a href={`${EXPLORER}/block/${j.blockHash}`} target="_blank" rel="noopener noreferrer" className="st-btn">Block {heightLabel(j.blockHeight)} <ExternalLinkIcon aria-hidden /></a>
            )}
          </div>
          <FullDetails j={j} block={block} at={at} />
          <div className="jr-again">
            <GhostSearch />
          </div>
        </section>
      </main>
    </div>
  );
}

/** Chapter 02's heading in plain words. */
function wentHeadline(pay: number, change: number, notes: number, coinbase: boolean): string {
  const extra = `${change ? `, plus ${change === 1 ? "change" : `${change} coins of change`} back to the sender` : ""}${notes ? `, and ${notes === 1 ? "a note" : `${notes} notes`}` : ""}`;
  if (coinbase) return `It was paid out as ${pay === 1 ? "one new coin" : `${n(pay)} new coins`}${extra}.`;
  if (pay === 0) return change ? `All of it went back to the sender${notes ? ", with a note" : ""}.` : "It created no new coins.";
  if (pay === 1 && !change) return `All of it went into one new coin${extra}.`;
  return `It went to ${pay === 1 ? "one new coin" : `${n(pay)} new coins`}${extra}.`;
}

/** Fee as a share of what was spent: "0.42%", "0.003%", "under 0.001%". */
function feeShare(fee: number, spent: number): string {
  const p = (fee / Math.max(1, spent)) * 100;
  if (p < 0.001) return "under 0.001%";
  return `${p < 0.1 ? p.toPrecision(1) : p.toFixed(2)}%`;
}

function asGhostInput(i: JourneyInput): GhostInput {
  return { inputIndex: i.index, prevTxid: i.prevTxid, prevVout: i.prevVout, createdHeight: i.createdHeight ?? 0, createdTime: i.createdTime ?? 0, valueSats: i.valueSats, scriptType: i.scriptType, qualifies: i.dormant };
}

function CoinList({ title, items, total, at }: { title: string; items: JourneyInput[]; total: number; at: number }) {
  return (
    <div className="jr-list">
      <h3 className="jr-list-h">{title}{total > items.length ? ` · largest ${items.length} of ${n(total)}` : ""}</h3>
      <ol>
        {items.map((i) => (
          <li key={i.index} className={i.dormant ? "jr-row jr-row--old" : "jr-row"}>
            <span className="jr-amt num">{btc(i.valueSats)}</span>
            <span className="jr-what">
              {i.createdTime != null ? <>created {dateShort(i.createdTime)} · {ageCompact(i.createdTime, at)} before</> : "created by a transaction still waiting"}
              {i.minerReward ? " · miner reward" : ""}
              {i.dormant ? " · woke up" : ""}
            </span>
            {i.prevTxid && (
              <Link href={`/tx/${i.prevTxid}`} className="jr-follow" aria-label={`Follow this coin back to the transaction that created it`}>
                <ArrowLeftIcon aria-hidden /> Came from
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function OutList({ items, total, price }: { items: JourneyOutput[]; total: number; price: number | null }) {
  return (
    <div className="jr-list">
      <h3 className="jr-list-h">Where each coin went{total > items.length ? ` · first ${items.length} of ${n(total)}` : ""}</h3>
      <ol>
        {items.map((o) => (
          <li key={o.index} className="jr-row">
            <span className="jr-amt num">{o.kind === "data" ? "Note" : btc(o.valueSats)}</span>
            <span className="jr-what">
              {o.kind === "data" ? "data only, no bitcoin" : o.address ? <>to <Link href={`/address/${o.address}`} className="jr-addr"><code title={o.address}>{middleTruncate(o.address, 6)}</code></Link></> : "to a script without an address"}
              {o.kind === "change" ? " · back to the sender" : ""}
              {price != null && o.kind !== "data" && o.valueSats > 0 ? ` · ${usd((o.valueSats / 1e8) * price)}` : ""}
            </span>
            {o.kind === "data" ? null : o.next == null ? (
              <span className="jr-next">Unknown</span>
            ) : o.next.spent ? (
              <Link href={`/tx/${o.next.txid}`} className="jr-follow" aria-label="Follow this coin to the transaction that spent it">
                Moved on{o.next.time ? ` ${dateShort(o.next.time)}` : " (waiting)"} <ArrowRightIcon aria-hidden />
              </Link>
            ) : (
              <span className="jr-next">Still there</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function WaitOutlook({ rate, fees, firstSeen, now }: { rate: number; fees: { fastest: number; halfHour: number; hour: number; economy: number; minimum: number } | null; firstSeen: number | null; now: number }) {
  const outlook = !fees
    ? null
    : rate >= fees.fastest
      ? "That's enough for the next block or two."
      : rate >= fees.hour
        ? "That should get it in within about an hour."
        : rate >= fees.economy
          ? "That's on the low side; it may take a few hours."
          : "That's below what miners are taking right now. It may wait a long time, or drop out of the queue.";
  return (
    <p>
      {firstSeen ? <>It was first seen <b>{ago(now - firstSeen)}</b>. </> : null}
      {outlook}
      {fees ? <> Right now the next block is taking about <b className="num">{fees.fastest} sat/vB</b>.</> : null}
    </p>
  );
}

function FullDetails({ j, block, at }: { j: Journey; block: BlockInfo | null; at: number }) {
  return (
    <details className="st-details">
      <summary>Full details: every input and output</summary>
      <dl className="ledger">
        <div>
          <dt>Transaction</dt>
          <dd><span className="hash"><code title={j.txid}>{j.txid}</code><CopyButton value={j.txid} label="Copy transaction ID" toast="Transaction ID copied" /></span></dd>
        </div>
        {j.blockHash && j.blockHeight != null && <div><dt>Block</dt><dd>{heightLabel(j.blockHeight)} · <span title={j.blockHash}>{middleTruncate(j.blockHash, 6)}</span>{block?.pool ? ` · ${block.pool}` : ""}</dd></div>}
        <div><dt>Status</dt><dd>{j.confirmed ? `${n(j.confirmations)} confirmation${j.confirmations === 1 ? "" : "s"} · ${dateTimeUtc(at)}` : "Waiting in the mempool"}</dd></div>
        <div><dt>Size</dt><dd className="num">{n(j.vsize)} vB · {n(j.weight)} WU</dd></div>
        {j.feeSats != null && <div><dt>Fee</dt><dd className="num">{n(j.feeSats)} sats · {j.feeRate!.toFixed(2)} sat/vB</dd></div>}
        <div><dt>In / out</dt><dd className="num">{btc(j.totalInSats)} in · {btc(j.totalOutSats)} out</dd></div>
        <div>
          <dt>How age is measured</dt>
          <dd className="prose">For each coin spent, the time of the block that spent it minus the time of the block that created it. Change is only marked when coins return to an address that was also spent from. Prices are daily USD closes from mempool.space.</dd>
        </div>
      </dl>
      <div className="inputs-wrap" tabIndex={0} role="region" aria-label="Inputs">
        <table className="inputs">
          <thead><tr><th scope="col">Input</th><th scope="col">Created</th><th scope="col">Age</th><th scope="col">Type</th><th scope="col">BTC</th></tr></thead>
          <tbody>
            {j.inputs.map((i) => (
              <tr key={i.index} data-q={String(i.dormant)}>
                <td><Link href={`/tx/${i.prevTxid}`} title={`${i.prevTxid}:${i.prevVout}`}>{middleTruncate(i.prevTxid, 4)}:{i.prevVout}</Link></td>
                <td>{i.createdTime != null ? isoDate(i.createdTime) : "waiting"}</td>
                <td>{i.createdTime != null ? ageCompact(i.createdTime, at) : "—"}</td>
                <td>{i.scriptType ? (SCRIPT_TAG[i.scriptType] ?? i.scriptType) : "—"}</td>
                <td className="num">{satsToBtcString(i.valueSats)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="inputs-wrap" tabIndex={0} role="region" aria-label="Outputs">
        <table className="inputs">
          <thead><tr><th scope="col">Output</th><th scope="col">Address</th><th scope="col">Type</th><th scope="col">Next</th><th scope="col">BTC</th></tr></thead>
          <tbody>
            {j.outputs.map((o) => (
              <tr key={o.index}>
                <td>{o.index}</td>
                <td>{o.address ? <span title={o.address}>{middleTruncate(o.address, 6)}</span> : "—"}</td>
                <td>{o.scriptType ? (SCRIPT_TAG[o.scriptType] ?? o.scriptType) : "—"}</td>
                <td>{o.next == null ? "—" : o.next.spent ? <Link href={`/tx/${o.next.txid}`}>{middleTruncate(o.next.txid, 4)}</Link> : "unspent"}</td>
                <td className="num">{satsToBtcString(o.valueSats)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {j.inputs[0]?.scriptType && SCRIPT[j.inputs[0].scriptType] && <p className="note">The first coin spent was locked with {SCRIPT[j.inputs[0].scriptType]}.</p>}
    </details>
  );
}

function NotFollowable({ kind }: { kind: "not-found" | "block" | "invalid" | "error" }) {
  const copy = {
    invalid: { h: "That isn't a transaction ID.", p: "A transaction ID is 64 characters of 0–9 and a–f. Copy it whole from your wallet or a block explorer." },
    "not-found": { h: "No transaction with that ID.", p: "Check you copied all 64 characters. A transaction that was just sent can take a few seconds to reach the network." },
    block: { h: "That's a block, not a transaction.", p: "Opening the block instead." },
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
      <p className="freshline">Following the coins…</p>
      <div className="skeleton-row" />
      <div className="skeleton-row" />
    </main>
  );
}
