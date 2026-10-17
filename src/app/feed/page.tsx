import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { GhostDesk } from "@/components/console/ghost-desk";

export const metadata: Metadata = {
  title: "Ghost feed",
  description: "Bitcoin unspent for five years or more that just moved, from confirmed blocks.",
};

export default function FeedPage() {
  return (
    <Suspense fallback={<p className="lab-quiet" style={{ padding: 32 }}>Loading the ghost feed…</p>}>
      <Live />
    </Suspense>
  );
}

async function Live() {
  await connection();
  return <GhostDesk mode="feed" />;
}
