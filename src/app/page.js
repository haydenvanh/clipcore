"use client";

import { useState } from "react";
import NewVideoForm from "@/components/dashboard/NewVideoForm";
import VideoList from "@/components/dashboard/VideoList";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-3xl mx-auto w-full px-5 sm:px-6 py-10 space-y-10">
      <NewVideoForm onStarted={() => setRefreshKey((n) => n + 1)} />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-secondary-text">Your videos</h2>
        <VideoList refreshKey={refreshKey} />
      </section>
    </div>
  );
}
