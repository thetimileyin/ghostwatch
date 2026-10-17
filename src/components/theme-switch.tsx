"use client";

import { useTheme } from "@/lib/theme/theme";
import { MoonIcon, SunIcon } from "./icons";

/** One icon button: shows the theme you'd switch to. Saved in this browser only. */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className={`theme-btn ${className}`} onClick={() => setTheme(next)} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {theme === "dark" ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
    </button>
  );
}
