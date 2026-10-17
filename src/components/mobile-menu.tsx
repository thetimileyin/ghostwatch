"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "./icons";

/**
 * Hamburger for small screens. The button only shows below the breakpoint set in CSS;
 * the panel drops down under the header. Closes on Escape, on a link tap, or on
 * tapping outside.
 */
export function MobileMenu({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const outside = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <div ref={root} className={`mm ${className}`}>
      <button type="button" className="mm-btn" aria-expanded={open} aria-controls="mm-panel" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
        {open ? <CloseIcon aria-hidden /> : <MenuIcon aria-hidden />}
      </button>
      <div
        id="mm-panel"
        className="mm-panel"
        data-open={open || undefined}
        hidden={!open}
        onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
      >
        {children}
      </div>
    </div>
  );
}
