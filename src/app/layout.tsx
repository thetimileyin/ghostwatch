import type { Metadata, Viewport } from "next";
import { GeistPixelSquare } from "geist/font/pixel";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { WatchKeeper } from "@/components/watch";
import { Wordmark } from "@/components/wordmark";
import "./globals.css";

const grotesk = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(base),
  // Brand is GhostWatch; the full name "Bitcoin GhostWatch" leads where strangers first meet it.
  title: { default: "Bitcoin GhostWatch: watch Bitcoin move in real time", template: "%s · Bitcoin GhostWatch" },
  applicationName: "GhostWatch",
  description:
    "Watch Bitcoin move in real time: blocks, big transfers and coins waking up after years, in one live terminal.",
  openGraph: { siteName: "Bitcoin GhostWatch", type: "website" },
  // Lets feed readers find the RSS feed from any page.
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: "GhostWatch: old bitcoin waking up" }] } },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ebeae6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
  colorScheme: "light dark",
};

// Applies the saved theme before first paint so the page never flashes the wrong one.
const THEME_INIT = `try{var t=localStorage.getItem("gw:theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;else document.documentElement.dataset.theme="light"}catch(e){document.documentElement.dataset.theme="light"}`;


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable} ${GeistPixelSquare.variable}`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {children}
        <WatchKeeper />
        <footer className="foot">
          <div className="wrap">
            <span className="inline-flex items-center gap-2"><Wordmark size={18} /> There is no GhostWatch token. Anyone selling one is not us.</span>
            <nav aria-label="Footer" className="flex gap-5">
              <Link href="/about">How it works</Link>
              <Link href="/about#privacy">Privacy</Link>
              <Link href="/rss">RSS</Link>
              <a href="https://mempool.space" target="_blank" rel="noopener noreferrer">Verify on mempool.space</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
