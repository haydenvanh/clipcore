"use client";

import { useState } from "react";
import NewVideoForm from "@/components/dashboard/NewVideoForm";
import VideoList from "@/components/dashboard/VideoList";
import CreditsBadge from "@/components/dashboard/CreditsBadge";

export default function StudioPage() {
  // Bumped when a job starts, so the list and the balance both refetch at once.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Studio</h1>
          <p className="text-sm text-secondary-text mt-1">
            Drop in a long video. We&apos;ll find the moments worth posting.
          </p>
        </div>
        <CreditsBadge refreshKey={refreshKey} />
      </div>

      <NewVideoForm onStarted={() => setRefreshKey((n) => n + 1)} />

      <section className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-secondary-text">
          Recent
        </h2>
        <VideoList refreshKey={refreshKey} />
      </section>
    </div>
  );
}
