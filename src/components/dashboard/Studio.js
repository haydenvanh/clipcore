"use client";

import { useState } from "react";
import NewVideoForm from "@/components/dashboard/NewVideoForm";
import VideoList from "@/components/dashboard/VideoList";

/** The new-video form and the list it adds to, sharing a refresh signal. */
export default function Studio({ initialUrl }) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <NewVideoForm initialUrl={initialUrl} onStarted={() => setRefreshKey((n) => n + 1)} />
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-secondary-text">Your videos</h2>
        <VideoList refreshKey={refreshKey} />
      </section>
    </>
  );
}
