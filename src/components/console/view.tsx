"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type View = "simple" | "technical";
export const ViewCtx = createContext<View>("simple");
export const useView = () => useContext(ViewCtx);

const VIEW_KEY = "gw:view";

/** Simple/Technical preference, remembered in this browser only. */
export function useViewPreference(): [View, (v: View) => void] {
  const [view, setView] = useState<View>("simple");
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "technical") setTimeout(() => setView("technical"), 0);
    } catch {
      /* storage blocked: default view */
    }
  }, []);
  const choose = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  return [view, choose];
}
