import { pool } from "./pool";

/** Read a stored value (and when it was saved). Null if missing or the database is unreachable. */
export async function readCache<T>(key: string): Promise<{ value: T; savedAt: number } | null> {
  try {
    const r = await pool().query<{ value: T; updated_at: Date }>("select value, updated_at from app_cache where key = $1", [key]);
    return r.rows[0] ? { value: r.rows[0].value, savedAt: r.rows[0].updated_at.getTime() } : null;
  } catch {
    return null;
  }
}

/** Save a value; failures are ignored (the cache is a convenience, never required). */
export async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await pool().query(
      "insert into app_cache (key, value, updated_at) values ($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
      [key, JSON.stringify(value)],
    );
  } catch {
    /* best effort */
  }
}
