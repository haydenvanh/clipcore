import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mediaUrl, deletePrefix, safeFilename } from "@/lib/storage";
import { ApiError, handler, getOwner } from "@/lib/api";

/**
 * One video with its clips, ready to render in the UI: each clip carries a
 * playable URL, a download URL, a thumbnail, and its scores — so the page needs
 * no second round of requests to show anything.
 */
export const GET = handler("VIDEO_GET", async (req, ctx) => {
  const owner = await getOwner();
  const { id } = await ctx.params;

  const video = await prisma.video.findFirst({
    where: { id, userId: owner.id },
    include: {
      clips: { orderBy: { order: "asc" }, include: { renders: { orderBy: { createdAt: "asc" } } } },
      transcript: { select: { language: true } },
    },
  });
  if (!video) throw new ApiError(404, "Video not found.");

  const clips = await Promise.all(
    video.clips.map(async (clip, index) => {
      const render = clip.renders.find((r) => r.status === "COMPLETED") ?? clip.renders[0] ?? null;
      const filename = safeFilename(`${String(index + 1).padStart(2, "0")} ${clip.title || "clip"}`);

      return {
        id: clip.id,
        title: clip.title,
        summary: clip.summary,
        hook: clip.hook,
        reasoning: clip.reasoning,
        startSec: clip.startSec,
        endSec: clip.endSec,
        durationSec: Math.round((clip.endSec - clip.startSec) * 10) / 10,
        viralScore: clip.viralScore,
        clipScore: clip.clipScore,
        confidence: clip.confidence,
        status: render?.status ?? clip.status,
        error: render?.error ?? null,
        renderId: render?.id ?? null,
        aspectRatio: render?.aspectRatio ?? null,
        captionStyle: render?.captionStyle ?? null,
        videoUrl: render?.storageKey ? await mediaUrl(render.storageKey) : null,
        downloadUrl: render?.storageKey
          ? await mediaUrl(render.storageKey, { download: true, filename })
          : null,
        thumbnailUrl: render?.thumbnailKey ? await mediaUrl(render.thumbnailKey) : null,
      };
    })
  );

  const renders = video.clips.flatMap((clip) => clip.renders);

  return NextResponse.json({
    id: video.id,
    title: video.title,
    sourceUrl: video.sourceUrl,
    source: video.source,
    status: video.status,
    error: video.error,
    durationSec: video.durationSec,
    language: video.transcript?.language ?? null,
    createdAt: video.createdAt,
    completedAt: video.completedAt,
    thumbnailUrl: await mediaUrl(video.thumbnailKey),
    clips,
    progress: {
      rendersTotal: renders.length,
      rendersDone: renders.filter((r) => r.status === "COMPLETED").length,
      rendersFailed: renders.filter((r) => r.status === "FAILED").length,
    },
  });
});

/** Delete a video, everything derived from it, and its files on disk. */
export const DELETE = handler("VIDEO_DELETE", async (req, ctx) => {
  const owner = await getOwner();
  const { id } = await ctx.params;

  const video = await prisma.video.findFirst({
    where: { id, userId: owner.id },
    include: { clips: { select: { id: true } } },
  });
  if (!video) throw new ApiError(404, "Video not found.");

  // Stop any queued work for it, so the worker doesn't pick up a job for a
  // video that no longer exists.
  await prisma.job.updateMany({
    where: { refType: "video", refId: id, status: { in: ["QUEUED", "RUNNING"] } },
    data: { status: "CANCELED" },
  });

  // Cascades to clips, renders and the transcript.
  await prisma.video.delete({ where: { id } });

  await deletePrefix(`sources/${owner.id}/${id}`);
  await Promise.all(video.clips.map((clip) => deletePrefix(`clips/${owner.id}/${clip.id}`)));

  return NextResponse.json({ deleted: true });
});
