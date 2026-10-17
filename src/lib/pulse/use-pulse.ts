"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { classifyTx, type TxClass } from "./interest";
import type { Pulse, PulseBlock, PulseGhost, PulseTx } from "./types";

export type LiveEvent =
  | { kind: "tx"; key: string; at: number; tx: PulseTx; cls: TxClass; fresh: boolean }
  | { kind: "block"; key: string; at: number; block: PulseBlock; fresh: boolean }
  | { kind: "ghost"; key: string; at: number; ghost: PulseGhost; fresh: boolean };

const POLL_MS = 4000;
const MAX_EVENTS = 40;

/**
 * Polls our own /api/pulse (never third parties from the browser) and turns
 * successive snapshots into a stream of events: new blocks, notable
 * transactions and ghost awakenings. `newTxs` is every newly sampled tx,
 * notable or not, for visualisations that show all activity.
 */
export function usePulse() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [newTxs, setNewTxs] = useState<{ batch: number; txs: PulseTx[] }>({ batch: 0, txs: [] });
  const [newBlock, setNewBlock] = useState<{ batch: number; block: PulseBlock | null }>({ batch: 0, block: null });
  const [error, setError] = useState(false);
  const seenTx = useRef(new Set<string>());
  const seenGhost = useRef(new Set<string>());
  const tip = useRef<number | null>(null);
  const first = useRef(true);

  const tick = useCallback(async () => {
    try {
      const res = await fetch("/api/pulse", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const p = (await res.json()) as Pulse;
      const initial = first.current;
      first.current = false;
      const fresh: LiveEvent[] = [];

      const unseen = p.txs.filter((t) => !seenTx.current.has(t.txid));
      unseen.forEach((t) => seenTx.current.add(t.txid));
      for (const t of unseen) {
        const cls = classifyTx(t, p.fees?.fastest ?? null);
        if (cls !== "regular") fresh.push({ kind: "tx", key: `tx-${t.txid}`, at: t.seenAt, tx: t, cls, fresh: !initial });
      }

      const top = p.blocks[0];
      if (top) {
        if (tip.current == null) {
          p.blocks.slice(0, 3).forEach((b) => fresh.push({ kind: "block", key: `b-${b.height}`, at: b.time * 1000, block: b, fresh: false }));
        } else if (top.height > tip.current) {
          p.blocks.filter((b) => b.height > tip.current!).forEach((b) => fresh.push({ kind: "block", key: `b-${b.height}`, at: b.time * 1000, block: b, fresh: true }));
          setNewBlock((n) => ({ batch: n.batch + 1, block: top }));
        }
        tip.current = top.height;
      }

      for (const g of p.ghosts) {
        if (seenGhost.current.has(g.id)) continue;
        seenGhost.current.add(g.id);
        fresh.push({ kind: "ghost", key: `g-${g.id}`, at: g.blockTime * 1000, ghost: g, fresh: !initial });
      }

      setPulse(p);
      setError(false);
      if (!initial && unseen.length) setNewTxs((n) => ({ batch: n.batch + 1, txs: unseen }));
      if (initial) setNewTxs({ batch: 1, txs: p.txs });
      if (fresh.length) setEvents((prev) => [...fresh, ...prev].sort((a, b) => b.at - a.at).slice(0, MAX_EVENTS));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    const t0 = setTimeout(tick, 0);
    const id = setInterval(() => document.visibilityState === "visible" && tick(), POLL_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(id);
    };
  }, [tick]);

  return { pulse, events, newTxs, newBlock, error };
}

/** Wall clock that ticks every second (for "x seconds ago" and the next-block timer). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
