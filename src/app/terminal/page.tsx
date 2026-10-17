import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Console } from "@/components/console/console";

export const metadata: Metadata = {
  title: "Terminal",
  description: "Live Bitcoin monitor: blocks, the waiting queue, notable transactions, old coins waking up, and the network map.",
};

// Live view: rendered per request (it reads the clock), never prerendered.
export default function TerminalPage() {
  return (
    <Suspense fallback={<p className="lab-quiet" style={{ padding: 32 }}>Connecting to the network…</p>}>
      <Live />
    </Suspense>
  );
}

async function Live() {
  await connection();
  return <Console />;
}
