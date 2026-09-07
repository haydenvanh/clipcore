import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createDownloadUrl } from "@/lib/storage";
import { ApiError, handler, requireUser } from "@/lib/api";

/** One clip, its scores, and signed URLs for its renders. */
export const GET = handler("CLIP_GET", async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const clip = await prisma.clip.findFirst({
    where: { id, userId: user.id },
    include: { renders: { orderBy: { createdAt: "asc" } } },
  });
  if (!clip) throw new ApiError(404, "Clip not found.");

  // URLs are signed per request and short-lived, so a leaked link stops working.
  const renders = await Promise.all(
    clip.renders.map(async (render) => ({
      id: render.id,
      status: render.status,
      aspectRatio: render.aspectRatio,
      preset: render.preset,
      captionStyle: render.captionStyle,
      sizeBytes: render.sizeBytes ? Number(render.sizeBytes) : null,
      url: render.storageKey ? await createDownloadUrl(render.storageKey, { expiresIn: 3600 }) : null,
    }))
  );

  return NextResponse.json({
    clip: {
      id: clip.id, title: clip.title, summary: clip.summary, hook: clip.hook,
      reasoning: clip.reasoning, signals: clip.signals,
      viralScore: clip.viralScore, clipScore: clip.clipScore, confidence: clip.confidence,
      startSec: clip.startSec, endSec: clip.endSec,
      aspectRatio: renders[0]?.aspectRatio ?? "RATIO_9_16",
    },
    renders,
  });
});
