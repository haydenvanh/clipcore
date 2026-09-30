import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mediaUrl, safeFilename } from "@/lib/storage";
import { ApiError, handler, getOwner } from "@/lib/api";

/** One clip, its scores, and signed URLs for its renders. */
export const GET = handler("CLIP_GET", async (req, ctx) => {
  const user = await getOwner();
  const { id } = await ctx.params;

  const clip = await prisma.clip.findFirst({
    where: { id, userId: user.id },
    include: { renders: { orderBy: { createdAt: "asc" } } },
  });
  if (!clip) throw new ApiError(404, "Clip not found.");

  // Local media is served by /api/media; R2 media gets a short-lived signed URL.
  const renders = await Promise.all(
    clip.renders.map(async (render) => ({
      id: render.id,
      status: render.status,
      aspectRatio: render.aspectRatio,
      preset: render.preset,
      captionStyle: render.captionStyle,
      sizeBytes: render.sizeBytes ? Number(render.sizeBytes) : null,
      url: render.storageKey ? await mediaUrl(render.storageKey) : null,
      downloadUrl: render.storageKey
        ? await mediaUrl(render.storageKey, { download: true, filename: safeFilename(clip.title || "clip") })
        : null,
    }))
  );

  return NextResponse.json({
    clip: {
      id: clip.id, videoId: clip.videoId, title: clip.title, summary: clip.summary, hook: clip.hook,
      reasoning: clip.reasoning, signals: clip.signals,
      viralScore: clip.viralScore, clipScore: clip.clipScore, confidence: clip.confidence,
      startSec: clip.startSec, endSec: clip.endSec,
      aspectRatio: renders[0]?.aspectRatio ?? "RATIO_9_16",
    },
    renders,
  });
});
