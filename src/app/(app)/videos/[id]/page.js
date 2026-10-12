"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import useSWRish from "@/components/dashboard/useSWRish";
import { STAGES, TOTAL_STEPS, isWorking, formatDuration } from "@/components/dashboard/stages";
import {
  FiArrowLeft, FiDownload, FiLoader, FiAlertCircle, FiExternalLink, FiRotateCw, FiTrash2, FiCheck,
} from "react-icons/fi";

function ScoreBadge({ score }) {
  if (!Number.isFinite(score)) return null;
  const tone =
    score >= 80 ? "text-[#4ade80] border-[#4ade80]/30 bg-[#4ade80]/10"
    : score >= 60 ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
    : "text-secondary-text border-divider bg-bg-page";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${tone}`}>
      {Math.round(score)}
    </span>
  );
}

function ClipCard({ clip, index }) {
  const ready = clip.status === "COMPLETED" && clip.videoUrl;
  const failed = clip.status === "FAILED";

  return (
    <article className="panel overflow-hidden flex flex-col">
      <div className="relative aspect-[9/16] bg-black">
        {ready ? (
          <video
            src={clip.videoUrl}
            poster={clip.thumbnailUrl || undefined}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain"
          />
        ) : failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <FiAlertCircle className="text-red-400 text-xl" />
            <p className="text-xs text-red-400">Render failed</p>
            {clip.error && <p className="text-[11px] text-secondary-text line-clamp-4">{clip.error}</p>}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-secondary-text">
            <FiLoader className="animate-spin" />
            <p className="text-xs">Rendering…</p>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-start gap-2">
          <span className="text-xs text-secondary-text tabular-nums mt-0.5">
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className="text-sm font-medium leading-snug flex-1 line-clamp-2">
            {clip.title || "Untitled clip"}
          </p>
          <ScoreBadge score={clip.viralScore} />
        </div>

        <p className="text-xs text-secondary-text tabular-nums">
          {formatDuration(clip.startSec)}–{formatDuration(clip.endSec)} · {Math.round(clip.durationSec)}s
        </p>

        <div className="mt-auto pt-1 flex items-center gap-2">
          {ready ? (
            <a
              href={clip.downloadUrl}
              className="focus-ring flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary hover:bg-primary-hover px-3 py-2 text-xs font-medium text-white transition-colors"
            >
              <FiDownload /> Download
            </a>
          ) : (
            <span className="flex-1" />
          )}
          <Link
            href={`/clips/${clip.id}`}
            className="focus-ring inline-flex items-center justify-center rounded-md border border-divider hover:bg-bg-card-hover px-3 py-2 text-xs text-secondary-text transition-colors"
          >
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function VideoPage({ params }) {
  // params is a Promise in Next 16; `use` unwraps it in a client component.
  const { id } = use(params);
  const router = useRouter();
  const [busy, setBusy] = useState(null);

  const { data: video, error, loading, reload } = useSWRish(`/api/videos/${id}`, {
    pollMs: 3000,
    // Keep polling while the video is processing, and while any clip is still
    // rendering after the video itself has been marked done.
    pollWhile: (v) =>
      isWorking(v?.status) || (v?.clips ?? []).some((c) => c.status !== "COMPLETED" && c.status !== "FAILED"),
  });

  const retry = async () => {
    setBusy("retry");
    try {
      const res = await fetch(`/api/videos/${id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not retry.");
      toast.success(`Restarting from: ${data.from}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this video and all of its clips? This removes the files too.")) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete.");
      toast.success("Deleted.");
      router.push("/");
    } catch (err) {
      toast.error(err.message);
      setBusy(null);
    }
  };

  if (loading && !video) {
    return (
      <div className="flex justify-center py-24 text-secondary-text">
        <FiLoader className="animate-spin" />
      </div>
    );
  }

  if (error && !video) {
    return (
      <div className="max-w-5xl mx-auto w-full px-5 py-16 text-center">
        <p className="text-sm font-medium">{error.message}</p>
        <Link href="/" className="text-xs text-primary hover:underline mt-3 inline-block">
          Back to your videos
        </Link>
      </div>
    );
  }

  const stage = STAGES[video.status] ?? STAGES.PENDING;
  const working = isWorking(video.status);
  const { rendersDone, rendersTotal, rendersFailed } = video.progress;
  const renderPct = rendersTotal ? rendersDone / rendersTotal : 0;
  const pct =
    video.status === "RENDERING"
      ? ((4 + renderPct) / TOTAL_STEPS) * 100
      : Math.max(4, (stage.step / TOTAL_STEPS) * 100);

  return (
    <div className="max-w-6xl mx-auto w-full px-5 sm:px-6 lg:px-8 py-8 space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-secondary-text hover:text-primary-text transition-colors"
      >
        <FiArrowLeft /> All videos
      </Link>

      <header className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">
            {video.title || "Untitled video"}
          </h1>
          <p className="mt-1 text-xs text-secondary-text flex flex-wrap items-center gap-x-3 gap-y-1">
            {video.durationSec ? <span>{formatDuration(video.durationSec)}</span> : null}
            {video.language ? <span className="uppercase">{video.language}</span> : null}
            {video.sourceUrl && (
              <a
                href={video.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary-text"
              >
                Source <FiExternalLink />
              </a>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(video.status === "FAILED" || rendersFailed > 0) && (
            <button
              onClick={retry}
              disabled={busy !== null}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-divider hover:bg-bg-card-hover px-3 py-2 text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {busy === "retry" ? <FiLoader className="animate-spin" /> : <FiRotateCw />} Retry
            </button>
          )}
          <button
            onClick={remove}
            disabled={busy !== null}
            aria-label="Delete video"
            className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-divider hover:border-red-500/40 hover:text-red-400 px-3 py-2 text-xs text-secondary-text transition-colors disabled:opacity-50 cursor-pointer"
          >
            {busy === "delete" ? <FiLoader className="animate-spin" /> : <FiTrash2 />} Delete
          </button>
        </div>
      </header>

      {working && (
        <section className="panel p-5" aria-live="polite">
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="flex items-center gap-2 text-primary">
              <FiLoader className="animate-spin" />
              {video.status === "RENDERING" && rendersTotal
                ? `Rendering clips — ${rendersDone} of ${rendersTotal}`
                : stage.label}
            </span>
            <span className="text-xs text-secondary-text tabular-nums">
              Step {Math.max(1, stage.step)} of {TOTAL_STEPS - 1}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-bg-page overflow-hidden">
            <div className="h-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <ol className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {["EXTRACTING", "TRANSCRIBING", "ANALYZING", "RENDERING"].map((key) => {
              const s = STAGES[key];
              const done = stage.step > s.step;
              const current = stage.step === s.step;
              return (
                <li
                  key={key}
                  className={`flex items-center gap-1.5 ${
                    done ? "text-primary-text" : current ? "text-primary" : "text-secondary-text/60"
                  }`}
                >
                  {done ? <FiCheck className="text-[#4ade80]" /> : current ? <FiLoader className="animate-spin" /> : <span className="w-3 h-3 rounded-full border border-current opacity-50" />}
                  {s.label}
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-xs text-secondary-text">
            You can leave this page — processing continues in the background.
          </p>
        </section>
      )}

      {video.status === "FAILED" && (
        <section className="panel p-5 border-red-500/30">
          <p className="flex items-center gap-2 text-sm font-medium text-red-400">
            <FiAlertCircle /> Processing failed
          </p>
          <p className="mt-2 text-sm text-secondary-text whitespace-pre-wrap break-words">
            {video.error || "Unknown error."}
          </p>
        </section>
      )}

      {video.clips.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-medium">
              {video.clips.length} clip{video.clips.length === 1 ? "" : "s"}
            </h2>
            <span className="text-xs text-secondary-text">Best first · 9:16 · captions burned in</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {video.clips.map((clip, index) => (
              <ClipCard key={clip.id} clip={clip} index={index} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
