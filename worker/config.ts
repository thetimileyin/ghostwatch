import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { yearsToSeconds } from "@/lib/domain/time";
import type { DetectedEvent } from "@/lib/detector/detect";
import type { IngestConfig } from "@/lib/detector/ingest";
import { rpcFromEnv } from "@/lib/detector/rpc";
import { TELEGRAM } from "@/lib/publish/telegram";

// Next.js reads .env.local; load it here too so the worker shares one config file.
loadEnv({ path: ".env.local", override: false });

const num = (v: string | undefined, d: number) => (v == null || v === "" ? d : Number(v));

export function ingestConfig(): IngestConfig {
  const minYears = num(process.env.MIN_DORMANT_YEARS, 5);
  // Telegram threshold: only announce events that are old and large enough to be notable.
  const tgMinYears = num(process.env.TELEGRAM_MIN_YEARS, 10);
  const tgMinSats = Math.round(num(process.env.TELEGRAM_MIN_BTC, 1) * 1e8);
  const telegramOn = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID);
  return {
    rpc: rpcFromEnv(),
    minYears,
    channelsFor: (e: DetectedEvent) =>
      telegramOn && e.maxAgeSeconds >= yearsToSeconds(tgMinYears) && e.dormantSats >= tgMinSats ? [TELEGRAM] : [],
    log: (m) => console.log(`[${new Date().toISOString()}] ${m}`),
  };
}

export const POLL_MS = num(process.env.POLL_SECONDS, 60) * 1000;
