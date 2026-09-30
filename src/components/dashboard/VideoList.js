"use client";

import Link from "next/link";
import useSWRish from "./useSWRish";
import { STAGES, TOTAL_STEPS, isWorking, formatDuration, relativeTime } from "./stages";
import { FiFilm, FiAlertCircle, FiLoader, FiChevronRight } from "react-icons/fi";

/**
 * Past videos and their live status. Polls only while something is still
 * processing — a finished list has nothing to poll for.
 */
export default function VideoList({ refreshKey }) {
  const { data, loading, error } = useSWRish("/api/videos?limit=30", {
    pollMs: 4000,
    pollWhile: (latest) => (latest?.items ?? []).some((v) => isWorking(v.status)),
    refreshKey,
  });

  const videos = data?.items ?? [];

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16 text-secondary-text">
        <FiLoader className="animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel p-5 text-sm">
        <p className="font-medium text-red-400">Could not load your videos.</p>
        <p className="mt-1 text-secondary-text">{error.message}</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-divider rounded-xl">
        <FiFilm className="mx-auto text-2xl text-secondary-text mb-3" />
        <p className="text-sm font-medium">No videos yet</p>
        <p className="text-xs text-secondary-text mt-1">Paste a YouTube link above to start.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {videos.map((video) => {
        const stage = STAGES[video.status] ?? STAGES.PENDING;
        const working = isWorking(video.status);

        return (
          <li key={video.id}>
            <Link
              href={`/videos/${video.id}`}
              className="focus-ring panel flex items-center gap-4 p-3 hover:bg-bg-card-hover transition-colors"
            >
              <div className="w-24 aspect-video shrink-0 rounded-md bg-bg-page border border-divider overflow-hidden flex items-center justify-center">
                {video.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FiFilm className="text-secondary-text" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {video.title || video.sourceUrl || "Untitled video"}
                </p>
                <p className="text-xs text-secondary-text mt-0.5">
                  {relativeTime(video.createdAt)}
                  {video.durationSec ? ` · ${formatDuration(video.durationSec)}` : ""}
                </p>

                {working && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 max-w-[220px] rounded-full bg-bg-page overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{
                          width: `${
                            video.status === "RENDERING" && video.rendersTotal
                              ? (4 + video.rendersDone / video.rendersTotal) * (100 / TOTAL_STEPS)
                              : Math.max(4, (stage.step / TOTAL_STEPS) * 100)
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-primary">
                      {video.status === "RENDERING" && video.rendersTotal
                        ? `Rendering ${video.rendersDone}/${video.rendersTotal}`
                        : stage.label}
                    </span>
                  </div>
                )}

                {video.status === "FAILED" && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-400">
                    <FiAlertCircle className="shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{video.error || "Processing failed."}</span>
                  </p>
                )}

                {video.status === "COMPLETED" && (
                  <p className="mt-1.5 text-xs text-[#4ade80]">
                    {video.rendersDone} clip{video.rendersDone === 1 ? "" : "s"} ready
                    {video.rendersFailed > 0 ? ` · ${video.rendersFailed} failed` : ""}
                  </p>
                )}
              </div>

              <FiChevronRight className="shrink-0 text-secondary-text" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
