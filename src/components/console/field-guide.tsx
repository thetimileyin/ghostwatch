"use client";

import { useEffect, useRef } from "react";

const GUIDE = [
  { label: "New block", cls: "k-block", meaning: "Miners added a new batch of transactions to the chain.", why: "Confirmed transactions are final; blocks arrive about every 10 minutes.", not: "Not a sign of anything unusual on its own." },
  { label: "Waking coins", cls: "k-ghost", meaning: "Coins that sat unspent for 5+ years were spent.", why: "Long-dormant coins rarely move; when they do, people pay attention.", not: "Not proof of a sale, a hack, or who owns them. Old is not Satoshi." },
  { label: "100+ BTC", cls: "k-whale", meaning: "A transaction's outputs add up to 100 BTC or more.", why: "Very large movements can come from exchanges, funds or long-term holders.", not: "Not the amount sent: outputs include change returning to the sender." },
  { label: "10+ BTC", cls: "k-large", meaning: "Outputs add up to 10 BTC or more.", why: "Large but common; a sign of bigger players moving.", not: "Not a trade, and not necessarily a single person." },
  { label: "High fee", cls: "k-rush", meaning: "Paid well above the going rate to confirm faster.", why: "Urgency, or a mistake; clusters can push everyone's fees up.", not: "Not proof of panic or of a hack." },
  { label: "Chain weather", cls: "k-block", meaning: "A one-word summary of the network: Clear, Busy, Expensive, or Slow block.", why: "A quick read of whether now is a normal moment on the network.", not: "Not a forecast." },
];

/** Plain explanation of every signal: what it means, why it matters, what it doesn't prove. */
export function FieldGuide({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // Open once. No close() in cleanup: React's dev double-mount would fire the
    // dialog's close event and dismiss the guide the moment it opened. Unmounting
    // removes the dialog, which closes it anyway.
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="gw-guide" onClose={onClose} aria-labelledby="guide-h">
      <header>
        <h2 id="guide-h">Field guide</h2>
        <button type="button" className="cb-guide" onClick={onClose}>Close</button>
      </header>
      <p className="gw-guide-lede">Everything here comes from public Bitcoin data. Each signal says what it means, why it matters, and what it doesn&apos;t prove.</p>
      {GUIDE.map((r) => (
        <div key={r.label} className="gg">
          <span className={`ss-kind ${r.cls}`}>{r.label}</span>
          <dl>
            <div><dt>Meaning</dt><dd>{r.meaning}</dd></div>
            <div><dt>Why it matters</dt><dd>{r.why}</dd></div>
            <div><dt>Not proof of</dt><dd>{r.not}</dd></div>
          </dl>
        </div>
      ))}
    </dialog>
  );
}
