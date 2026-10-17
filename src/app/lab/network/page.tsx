import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { NetworkConcept } from "@/components/lab/network";

export const metadata: Metadata = { title: "Concept A · Living Network" };

// Live view: rendered per request (it reads the clock), never prerendered.
export default function Page() {
  return (
    <Suspense fallback={<p className="lab-quiet" style={{ padding: 32 }}>Connecting to the network…</p>}>
      <Live />
    </Suspense>
  );
}

async function Live() {
  await connection();
  return <NetworkConcept />;
}
