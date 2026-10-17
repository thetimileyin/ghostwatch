// What's next on the landing page: three cards, each with a small drawing of the idea.

const NEXT = [
  {
    n: "01",
    title: "Vault tripwire",
    body: "A private alert the moment coins leave your cold storage. Watch-only: no keys, no account.",
    art: <VaultArt />,
  },
  {
    n: "02",
    title: "Haunted coin check",
    body: "Whether a coin's public key is already exposed on-chain, the main quantum risk. One address at a time, nothing stored.",
    art: <KeyArt />,
  },
  {
    n: "03",
    title: "Alerts and API",
    body: "Telegram alerts for big moves, plus webhooks and an MCP server for builders.",
    art: <WireArt />,
  },
];

export function NextCards() {
  return (
    <ul className="nx">
      {NEXT.map((c) => (
        <li key={c.title} className="nx-card">
          <div className="nx-art" aria-hidden="true">
            {c.art}
          </div>
          <div className="nx-body">
            <div className="nx-top">
              <span className="nx-n">{c.n}</span>
              <span className="nx-soon">Coming soon</span>
            </div>
            <h3 className="nx-title">{c.title}</h3>
            <p className="nx-desc">{c.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A row of blocks with a wire running past them; one block is the vault, and the wire trips at the end. */
function VaultArt() {
  return (
    <svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid meet">
      <line x1="16" y1="70" x2="304" y2="70" className="nx-wire" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={36 + i * 52} y={50} width={40} height={40} className={i === 2 ? "nx-blk nx-blk--on" : "nx-blk"} />
      ))}
      <rect x={153} y={68} width={14} height={12} className="nx-lock" />
      <path d="M156 68 v-4 a4 4 0 0 1 8 0 v4" className="nx-lock-arc" />
      <circle cx={296} cy={70} r={4} className="nx-trip" />
      <circle cx={296} cy={70} r={4} className="nx-trip nx-ping" />
    </svg>
  );
}

/** A public key, mostly hidden, with the exposed part lit. */
function KeyArt() {
  const hex = "02f9a1c4e87b3d0e5a62";
  return (
    <svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid meet">
      {[48, 34, 20].map((r) => (
        <circle key={r} cx={160} cy={56} r={r} className="nx-ring" />
      ))}
      <circle cx={160} cy={56} r={5} className="nx-core" />
      <text x={160} y={134} textAnchor="middle" className="nx-hex">
        {hex.split("").map((ch, i) => (
          <tspan key={i} className={i >= 6 && i < 12 ? "nx-hex-on" : undefined}>
            {ch}
          </tspan>
        ))}
      </text>
    </svg>
  );
}

/** A big move fanning out to the places that listen: Telegram, a webhook, an agent. */
function WireArt() {
  const ends = [
    [256, 30],
    [276, 70],
    [256, 110],
  ];
  return (
    <svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid meet">
      {ends.map(([x, y]) => (
        <path key={y} d={`M84 70 C 170 70, 170 ${y}, ${x} ${y}`} className="nx-arc" />
      ))}
      <rect x={44} y={50} width={40} height={40} className="nx-blk nx-blk--on" />
      {ends.map(([x, y]) => (
        <circle key={y} cx={x} cy={y} r={5} className="nx-end" />
      ))}
    </svg>
  );
}
