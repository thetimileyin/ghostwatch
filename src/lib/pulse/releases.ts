import { readCache, writeCache } from "@/lib/db/cache";

/** The newest Bitcoin Core release: shown in the Nodes panel and pinned in the chain log. */
export interface CoreRelease {
  /** "32.1" */
  version: string;
  /** Unix seconds. */
  publishedAt: number;
  /** Official release notes on bitcoincore.org. */
  notesUrl: string;
}

const KEY = "core-release:v1";
const TTL_MS = 6 * 3600_000;
const RETRY_MS = 30 * 60_000;

const state = globalThis as unknown as { gwRelease?: { at: number; data: CoreRelease | null; inflight?: Promise<void> } };

async function refresh() {
  const s = (state.gwRelease ??= { at: 0, data: null });
  try {
    const res = await fetch("https://api.github.com/repos/bitcoin/bitcoin/releases/latest", {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
      headers: { accept: "application/vnd.github+json", "user-agent": "GhostWatch" },
    });
    if (!res.ok) throw new Error(String(res.status));
    const r = (await res.json()) as { tag_name?: string; published_at?: string; prerelease?: boolean; draft?: boolean };
    const version = r.tag_name?.replace(/^v/, "");
    if (!version || r.prerelease || r.draft || !/^\d+\.\d+(\.\d+)?$/.test(version) || !r.published_at) throw new Error("not a final release");
    s.data = { version, publishedAt: Math.floor(Date.parse(r.published_at) / 1000), notesUrl: `https://bitcoincore.org/en/releases/${version}/` };
    s.at = Date.now();
    void writeCache(KEY, s.data);
  } catch {
    s.at = Date.now() - TTL_MS + RETRY_MS; // try again in half an hour
  }
}

/**
 * Latest Bitcoin Core release, from the project's public GitHub releases. Answers from
 * memory (or the saved copy after a restart) and refreshes in the background every 6 hours,
 * so it never slows a page down.
 */
export async function getCoreRelease(): Promise<CoreRelease | null> {
  const s = (state.gwRelease ??= { at: 0, data: null });
  if (!s.data) {
    const saved = await readCache<CoreRelease>(KEY).catch(() => null);
    if (saved) s.data = saved.value;
  }
  if (Date.now() - s.at > TTL_MS && !s.inflight) {
    s.inflight = refresh().finally(() => {
      delete s.inflight;
    });
    if (!s.data) await s.inflight; // first ever: wait once so there's something to show
  }
  return s.data;
}
