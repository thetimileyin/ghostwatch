"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "gw:theme";
const EVENT = "gw-theme";

function current(): Theme {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** The active theme, plus a setter that saves it and tells canvases to recolour. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const sync = () => setTheme(current());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const set = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(KEY, t);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return [theme, set];
}

/** Colours canvases draw with, read from the CSS tokens as "r,g,b" strings. */
export interface Palette {
  dark: boolean;
  bg: string;
  fg: string;
  fg2: string;
  fg3: string;
  fg4: string;
  line: string;
  accent: string;
  wait: string;
}

let cached: Palette | null = null;
if (typeof window !== "undefined") window.addEventListener(EVENT, () => (cached = null));

function rgb(v: string): string {
  const h = v.trim().replace("#", "");
  if (h.length !== 6) return "128,128,128";
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
}

export function palette(): Palette {
  if (cached) return cached;
  const cs = getComputedStyle(document.documentElement);
  const g = (n: string) => rgb(cs.getPropertyValue(n));
  cached = {
    dark: current() === "dark",
    bg: g("--void"),
    fg: g("--fg"),
    fg2: g("--fg-2"),
    fg3: g("--fg-3"),
    fg4: g("--fg-4"),
    line: g("--fg-4"),
    accent: g("--accent"),
    wait: rgb(cs.getPropertyValue("--wait")),
  };
  return cached;
}
