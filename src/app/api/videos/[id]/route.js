import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handler, requireUser } from "@/lib/api";

/** One video with its clips, renders, and live progress. */
export const GET = handler("VIDEO_GET", async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const video = await prisma.video.findFirst({
    where: { id, userId: user.id },
    include: {
      clips: {
        orderBy: { order: "asc" },
        include: { renders: true },
      },
      transcript: { select: { language: true } },
    },
  });
  if (!video) throw new ApiError(404, "Video not found.");

  const totalRenders = video.clips.reduce((sum, clip) => sum + clip.renders.length, 0);
  const doneRenders = video.clips.reduce(
    (sum, clip) => sum + clip.renders.filter((r) => r.status === "COMPLETED").length,
    0
  );

  return NextResponse.json({
    ...video,
    sizeBytes: video.sizeBytes ? Number(video.sizeBytes) : null,
    clips: video.clips.map((clip) => ({
      ...clip,
      renders: clip.renders.map((r) => ({ ...r, sizeBytes: r.sizeBytes ? Number(r.sizeBytes) : null })),
    })),
    progress: { totalRenders, doneRenders },
  });
});

/** Delete a video and everything derived from it. */
export const DELETE = handler("VIDEO_DELETE", async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const video = await prisma.video.findFirst({ where: { id, userId: user.id } });
  if (!video) throw new ApiError(404, "Video not found.");

  // Cascades to clips, renders, and the transcript.
  await prisma.video.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
});
