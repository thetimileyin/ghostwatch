import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getEvent } from "@/lib/db/read";
import { dateShort, monthYear, satsToBtcString } from "@/lib/domain/format";
import { ageClause } from "@/lib/domain/signal";
import { GENESIS_TIME } from "@/lib/domain/time";

export const alt = "A Bitcoin GhostWatch event: dormant bitcoin that moved";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (f: string) => readFile(join(process.cwd(), "assets/fonts", f));
const fontsP = Promise.all([
  font("schibsted-grotesk-latin-400-normal.woff"),
  font("schibsted-grotesk-latin-600-normal.woff"),
  font("jetbrains-mono-latin-400-normal.woff"),
  font("jetbrains-mono-latin-500-normal.woff"),
]);

const C = { void: "#05070b", fg: "#e6edf5", fg2: "#a3afbf", fg3: "#748196", line: "rgba(150,180,220,0.18)", signal: "#7fe6f5", btc: "#f7931a", bad: "#ff8170", uv: "#a99bff" };
const AGE = { 5: "#7fa9c6", 10: "#7fe6f5", 15: "#eafbff" } as const;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [g4, g6, m4, m5] = await fontsP;
  const e = await getEvent(id).catch(() => null);
  const now = Date.now() / 1000;
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - GENESIS_TIME) / (now - GENESIS_TIME)) * 100));

  const amount = e ? satsToBtcString(e.dormantSats) : null;
  const [head, tail] = amount ? [amount.slice(0, amount.indexOf(".") + 3), amount.slice(amount.indexOf(".") + 3)] : ["", ""];
  const age = e ? AGE[e.cohort] : C.signal;
  const tag = !e ? "" : e.status === "reversed" ? "REVERSED" : e.origin === "archive" ? "ARCHIVE" : "CONFIRMED";
  const tagColor = !e ? C.fg3 : e.status === "reversed" ? C.bad : e.origin === "archive" ? C.uv : C.signal;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "56px 64px", color: C.fg, fontFamily: "Grotesk",
          background: `radial-gradient(900px 420px at 78% -60px, rgba(127,230,245,0.16), transparent 70%), radial-gradient(700px 380px at 0% -40px, rgba(169,155,255,0.12), transparent 70%), ${C.void}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="12.5" stroke="#a3afbf" strokeOpacity=".55" strokeWidth="1.5" />
              <path d="M16 3.5a12.5 12.5 0 0 1 12.5 12.5" stroke="#7fe6f5" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="16" cy="16" r="5" stroke="#e6edf5" strokeWidth="1.5" />
              <circle cx="24.8" cy="7.2" r="1.8" fill="#eafbff" />
            </svg>
            <span>Ghost</span>
            <span style={{ color: C.fg3, marginLeft: -14 }}>Watch</span>
          </div>
          {e && (
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 22, color: tagColor, border: `1px solid ${tagColor}`, borderRadius: 6, padding: "6px 14px" }}>
              {tag} · BLOCK {e.blockHeight.toLocaleString("en-US")}
            </div>
          )}
        </div>

        {e ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Mono", fontSize: 92, letterSpacing: -4, lineHeight: 1 }}>
              <span>{head}</span>
              <span style={{ color: C.fg3 }}>{tail}</span>
              <span style={{ color: C.btc, fontSize: 40, marginLeft: 18, letterSpacing: 1 }}>BTC</span>
            </div>
            <div style={{ display: "flex", fontSize: 46, fontWeight: 600, letterSpacing: -1.5, marginTop: 18 }}>
              {ageClause(e)}, then moved.
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
              <div style={{ display: "flex", position: "relative", height: 24, alignItems: "center" }}>
                <div style={{ display: "flex", position: "absolute", left: 0, right: 0, top: 11, height: 2, background: C.line }} />
                <div style={{ display: "flex", position: "absolute", left: `${pct(e.oldestCreatedTime)}%`, right: `${100 - pct(e.blockTime)}%`, top: 10, height: 4, borderRadius: 2, background: `linear-gradient(90deg, rgba(127,169,198,0.1), ${age})` }} />
                <div style={{ display: "flex", position: "absolute", left: `${pct(e.blockTime)}%`, top: 4, width: 16, height: 16, marginLeft: -8, borderRadius: 8, background: e.status === "reversed" ? C.bad : C.fg, boxShadow: `0 0 24px ${age}` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Mono", fontSize: 22, color: C.fg3, marginTop: 10 }}>
                <span>Created {monthYear(e.oldestCreatedTime)}</span>
                <span>Spent {dateShort(e.blockTime)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 64, fontWeight: 600 }}>When old bitcoin wakes up.</div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Mono", fontSize: 20, color: C.fg3 }}>
          <span>Not proof of a sale, a hack, or who owns it.</span>
          <span>{new URL(process.env.PUBLIC_BASE_URL ?? "https://bitcoinghostwatch.com").host}</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Grotesk", data: g4, weight: 400, style: "normal" },
        { name: "Grotesk", data: g6, weight: 600, style: "normal" },
        { name: "Mono", data: m4, weight: 400, style: "normal" },
        { name: "Mono", data: m5, weight: 500, style: "normal" },
      ],
    },
  );
}
