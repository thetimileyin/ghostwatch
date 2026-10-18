import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { getEvent } from "@/lib/db/read";
import { btcShort, durationLong, monthYear } from "@/lib/domain/format";
import { GENESIS_TIME } from "@/lib/domain/time";
import { OG, OG_SIZE, OgBrand, ogBackground, ogFonts } from "@/lib/og/brand";

export const alt = "A Bitcoin GhostWatch event: long-dormant bitcoin that moved";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const e = await getEvent(id).catch(() => null);
  const pct = (t: number, end: number) => Math.max(0, Math.min(100, ((t - GENESIS_TIME) / (end - GENESIS_TIME)) * 100));
  const reversed = e?.status === "reversed";
  const tag = !e ? "" : reversed ? "REVERSED" : e.origin === "archive" ? "FROM THE ARCHIVE" : "CONFIRMED";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "52px 60px", color: OG.fg, fontFamily: "Grotesk", ...ogBackground("26% 52%") }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <OgBrand />
          {e && (
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 18, letterSpacing: 1.5, color: reversed ? OG.bad : OG.fg2, border: `1px solid ${reversed ? OG.bad : OG.line2}`, padding: "8px 14px" }}>
              {tag} · BLOCK {e.blockHeight.toLocaleString("en-US")}
            </div>
          )}
        </div>

        {e ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "Mono", fontSize: 20, letterSpacing: 3, color: OG.fg3 }}>[ OLD COINS WOKE UP ]</div>
            <div style={{ display: "flex", fontFamily: "Mono", fontWeight: 500, fontSize: 104, letterSpacing: -4, lineHeight: 1, marginTop: 18, color: OG.accent, textShadow: "0 0 40px rgba(247,147,26,0.35)" }}>
              {btcShort(e.dormantSats)}
            </div>
            <div style={{ display: "flex", fontSize: 50, fontWeight: 600, letterSpacing: -1.6, marginTop: 14 }}>
              slept {durationLong(e.oldestCreatedTime, e.blockTime)}, then moved.
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 38 }}>
              <div style={{ display: "flex", position: "relative", height: 22, border: `1px solid ${OG.line2}`, background: `repeating-linear-gradient(135deg, ${OG.line} 0 2px, transparent 2px 9px)` }}>
                <div style={{ display: "flex", position: "absolute", top: 4, bottom: 4, left: `${pct(e.oldestCreatedTime, e.blockTime)}%`, right: 4, background: reversed ? OG.bad : OG.accent, boxShadow: "0 0 22px rgba(247,147,26,0.45)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Mono", fontSize: 20, color: OG.fg3, marginTop: 10 }}>
                <span>2009</span>
                <span style={{ color: OG.fg2 }}>{monthYear(e.oldestCreatedTime)} to {monthYear(e.blockTime)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 72, fontWeight: 600, letterSpacing: -2.5 }}>When old bitcoin wakes up.</div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Mono", fontSize: 18, letterSpacing: 0.5, color: OG.fg3 }}>
          <span>Not proof of a sale, a hack, or who owns it.</span>
          <span>{new URL(process.env.PUBLIC_BASE_URL ?? "https://bitcoinghostwatch.com").host}</span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
