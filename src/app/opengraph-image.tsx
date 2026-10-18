import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OgBrand, ogBackground, ogFonts } from "@/lib/og/brand";

export const alt = "Bitcoin GhostWatch: watch Bitcoin move in real time";
export const size = OG_SIZE;
export const contentType = "image/png";

// Site-wide share card (landing, terminal, feed). Static: no live numbers to go stale in previews.
export default async function Image() {
  const blocks = [0.55, 0.7, 0.62, 0.9, 0.75, 0.82];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "52px 60px", color: OG.fg, fontFamily: "Grotesk", ...ogBackground("78% 46%") }}>
        <OgBrand />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 20, letterSpacing: 3, color: OG.fg3 }}>[ LIVE BITCOIN INTELLIGENCE ]</div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 600, letterSpacing: -4, lineHeight: 1, marginTop: 20 }}>
            <span>Watch Bitcoin move</span>
            <span style={{ color: OG.fg3 }}>in real time.</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: OG.fg2, marginTop: 26 }}>Blocks, big transfers and coins waking up after years.</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            {blocks.map((f, i) => (
              <div key={i} style={{ display: "flex", position: "relative", width: 44, height: 44, border: `1px solid ${OG.line2}` }}>
                <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, height: `${f * 100}%`, background: OG.fg, opacity: 0.55 }} />
              </div>
            ))}
            <div style={{ display: "flex", position: "relative", width: 44, height: 44, border: `1px dashed ${OG.accent}` }}>
              <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, height: "40%", background: OG.accent, boxShadow: "0 0 18px rgba(247,147,26,0.5)" }} />
            </div>
          </div>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 18, color: OG.fg3 }}>No accounts · Public data only</div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
