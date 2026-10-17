// Dev/QA only: pretend the latest processed block was replaced by a reorg.
// Marks its events reversed (with history and correction notifications) and
// rewinds the checkpoint one block. The running worker then re-processes the
// real block and re-confirms the events, exercising the full recovery path.
// Usage: npm run simulate:reorg
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { LIVE_WORKER } from "@/lib/db/constants";
import { pool } from "@/lib/db/pool";
import { getCheckpoint, mainBlockAt, rollbackTo } from "@/lib/db/store";

loadEnv({ path: ".env.local", override: false });

async function main() {
  const cp = await getCheckpoint(LIVE_WORKER);
  if (!cp?.lastHeight) throw new Error("no live checkpoint yet; run the worker first");
  const fork = await mainBlockAt(cp.lastHeight - 1);
  if (!fork) throw new Error(`block ${cp.lastHeight - 1} isn't stored; let the worker process two blocks first`);
  const reversed = await rollbackTo(LIVE_WORKER, fork.height, fork.hash);
  console.log(`rolled back block ${cp.lastHeight}; reversed ${reversed.length} event(s): ${reversed.join(", ")}`);
  await pool().end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
