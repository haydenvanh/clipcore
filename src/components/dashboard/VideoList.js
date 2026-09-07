"use client";

import Link from "next/link";
import useSWRish from "./useSWRish";
import { FiFilm, FiAlertCircle, FiLoader, FiCheck } from "react-icons/fi";

/** Human-readable pipeline state, in the order the user experiences it. */
const STAGES = {
  PENDING: { label: "Queued", step: 0 },
  EXTRACTING: { label: "Downloading video", step: 1 },
  TRANSCRIBING: { label: "Transcribing audio", step: 2 },
  ANALYZING: { label: "Finding the best moments", step: 3 },
  RENDERING: { label: "Rendering clips", step: 4 },
  COMPLETED: { label: "Done", step: 5 },
  FAILED: { label: "Failed", step: -1 },
  CANCELED: { label: "Canceled", step: -1 },
};
const TOTAL_STEPS = 5;

function relativeTime(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ProgressBar({ status }) {
  const stage = STAGES[status] ?? STAGES.PENDING;
  const pct = Math.max(4, (stage.step / TOTAL_STEPS) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
        <span className="text-primary">{stage.label}</span>
        <span className="text-secondary-text tabular-nums">
          {stage.step}/{TOTAL_STEPS}
        </span>
      </div>
      <div className="h-1 bg-bg-page rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 animate-pulse-glow"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Recent videos and their live status.
 *
 * Polls only while something is actually in flight — a finished list has
 * nothing to poll for, and the old code polled every 3 seconds forever.
 */
export default function VideoList({ refreshKey }) {
  const { data, loading } = useSWRish("/api/videos?limit=10", {
    pollMs: 5000,
    refreshKey,
  });

  const videos = data?.items ?? [];
  const isWorking = (v) => !["COMPLETED", "FAILED", "CANCELED"].includes(v.status);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-secondary-text">
        <FiLoader className="animate-spin" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-divider/60 rounded-2xl">
        <FiFilm className="mx-auto text-2xl text-secondary-text mb-3" />
        <p className="text-sm font-semibold">No videos yet</p>
        <p className="text-xs text-secondary-text mt-1">
          Paste a YouTube link above to get your first clips.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {videos.map((video) => {
        const clipCount = video.clips?.length ?? 0;
        const working = isWorking(video);

        return (
          <div
            key={video.id}
            className="bg-bg-card border border-divider/60 rounded-xl p-5 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate">
                  {video.title || video.sourceUrl || "Untitled video"}
                </h3>
                <p className="text-xs text-secondary-text mt-0.5">
                  {relativeTime(video.createdAt)}
                  {video.durationSec ? ` · ${Math.round(video.durationSec / 60)} min` : ""}
                  {video.creditsHeld ? ` · ${video.creditsHeld} credits` : ""}
                </p>
              </div>

              {video.status === "COMPLETED" && (
                <Link
                  href={`/gallery?video=${video.id}`}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                  <FiCheck /> {clipCount} clip{clipCount === 1 ? "" : "s"}
                </Link>
              )}
            </div>

            {working && <ProgressBar status={video.status} />}

            {video.status === "FAILED" && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <FiAlertCircle className="text-red-500 text-sm shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-red-500">Processing failed</p>
                  <p className="text-secondary-text mt-0.5">
                    {video.error || "Something went wrong."} Your credits were refunded.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
