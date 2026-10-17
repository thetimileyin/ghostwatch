import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { GhostDesk } from "@/components/console/ghost-desk";

export const metadata: Metadata = {
  title: "Archive",
  description: "Real awakenings of long-dormant bitcoin from before GhostWatch went live, found by running the same detector over past blocks.",
};

export default function ArchivePage() {
  return (
    <Suspense fallback={<p className="lab-quiet" style={{ padding: 32 }}>Loading the archive…</p>}>
      <Live />
    </Suspense>
  );
}

async function Live() {
  await connection();
  return <GhostDesk mode="archive" />;
}
