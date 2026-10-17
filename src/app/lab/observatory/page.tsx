import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ObservatoryConcept } from "@/components/lab/observatory";

export const metadata: Metadata = { title: "Concept B · Observatory" };

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
  return <ObservatoryConcept />;
}
