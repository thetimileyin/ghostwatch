import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Share-card building blocks (rendered by next/og, so inline styles and flex only).

export const OG_SIZE = { width: 1200, height: 630 };

/** Fixed dark palette: share cards don't follow the visitor's theme. */
export const OG = {
  void: "#0b0b0c",
  panel: "#141415",
  fg: "#ecebe7",
  fg2: "#ababa6",
  fg3: "#82827d",
  line: "rgba(236,235,231,0.16)",
  line2: "rgba(236,235,231,0.32)",
  accent: "#f7931a",
  bad: "#ff8170",
};

const font = (f: string) => readFile(join(process.cwd(), "assets/fonts", f));
const fontsP = Promise.all([
  font("schibsted-grotesk-latin-400-normal.woff"),
  font("schibsted-grotesk-latin-600-normal.woff"),
  font("jetbrains-mono-latin-400-normal.woff"),
  font("jetbrains-mono-latin-500-normal.woff"),
]);

export async function ogFonts() {
  const [g4, g6, m4, m5] = await fontsP;
  return [
    { name: "Grotesk", data: g4, weight: 400 as const, style: "normal" as const },
    { name: "Grotesk", data: g6, weight: 600 as const, style: "normal" as const },
    { name: "Mono", data: m4, weight: 400 as const, style: "normal" as const },
    { name: "Mono", data: m5, weight: 500 as const, style: "normal" as const },
  ];
}

/** The brand mark, same drawing as the site's Wordmark component. */
export function OgMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12.5" stroke={OG.fg} strokeOpacity=".4" strokeWidth="1.5" />
      <path d="M16 3.5a12.5 12.5 0 0 1 12.5 12.5" stroke={OG.fg} strokeWidth="1.5" />
      <rect x="11" y="11" width="10" height="10" stroke={OG.fg} strokeWidth="1.5" />
      <rect x="23" y="5.4" width="3.6" height="3.6" fill={OG.accent} />
    </svg>
  );
}

/** Logo, name and the full product name. */
export function OgBrand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <OgMark />
      <div style={{ display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: -0.6 }}>
        <span>Ghost</span>
        <span style={{ color: OG.fg3 }}>Watch</span>
      </div>
      <div style={{ display: "flex", marginLeft: 6, fontFamily: "Mono", fontSize: 16, letterSpacing: 2, color: OG.fg3 }}>BITCOIN</div>
    </div>
  );
}

/** Background: near-black with a faint dot grid and one warm glow (longhand: next/og has no shorthand). */
export const ogBackground = (glowAt = "30% 55%") => ({
  backgroundColor: OG.void,
  backgroundImage: `radial-gradient(520px 300px at ${glowAt}, rgba(247,147,26,0.13), transparent 70%), radial-gradient(circle, rgba(236,235,231,0.09) 1px, transparent 1.4px)`,
  backgroundSize: "100% 100%, 22px 22px",
});
