import { Pool, type PoolClient } from "pg";
import { readFile } from "node:fs/promises";
import path from "node:path";

// One pool per process. In dev, Next's module reloads would otherwise leak pools.
const globalForPg = globalThis as unknown as { ghostwatchPool?: Pool };

export function pool(): Pool {
  if (!globalForPg.ghostwatchPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    // Set DATABASE_POOL_MAX=1 for the local PGlite server, which serves one connection at a time.
    const max = Number(process.env.DATABASE_POOL_MAX ?? 5);
    globalForPg.ghostwatchPool = new Pool({ connectionString, max });
  }
  return globalForPg.ghostwatchPool;
}

export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (err) {
    await c.query("rollback").catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}

export async function migrate(): Promise<void> {
  const sql = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  await pool().query(sql);
}
