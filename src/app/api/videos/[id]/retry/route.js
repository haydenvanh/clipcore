import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Queue, JOB_TYPES } from "@/lib/queue";
import { ApiError, handler, getOwner } from "@/lib/api";
import { resumePoint } from "@/lib/resume";

/**
 * Resume a failed video from the first stage that didn't finish.
 *
 * A render that fails re-runs only the render — not the download and the
 * transcription before it, which for an hour-long video is most of the time
 * and all of the API cost.
 */
export const POST = handler("VIDEO_RETRY", async (req, ctx) => {
  const owner = await getOwner();
  const { id } = await ctx.params;

  const video = await prisma.video.findFirst({
    where: { id, userId: owner.id },
    include: {
      transcript: { select: { id: true } },
      clips: { select: { id: true, renders: { select: { id: true, status: true } } } },
    },
  });
  if (!video) throw new ApiError(404, "Video not found.");

  const active = await prisma.job.count({
    where: { refType: "video", refId: id, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (active > 0) throw new ApiError(409, "This video is already processing.");

  const from = resumePoint(video);
  if (!from) throw new ApiError(409, "Nothing to retry — every clip rendered.");

  await prisma.$transaction(async (tx) => {
    if (from === "render") {
      const failed = video.clips.flatMap((c) => c.renders).filter((r) => r.status === "FAILED");
      await tx.render.updateMany({
        where: { id: { in: failed.map((r) => r.id) } },
        data: { status: "PENDING", error: null },
      });
      await tx.video.update({ where: { id }, data: { status: "RENDERING", error: null, completedAt: null } });
      for (const render of failed) {
        await Queue.enqueue(
          { type: JOB_TYPES.RENDER, payload: { renderId: render.id }, refType: "render", refId: render.id },
          tx
        );
      }
      return;
    }

    // Show the stage it resumes at, not "Queued / Downloading" for a video
    // whose download finished long ago.
    const status = { extract: "PENDING", transcribe: "TRANSCRIBING", analyze: "ANALYZING" }[from];
    await tx.video.update({ where: { id }, data: { status, error: null, completedAt: null } });
    await Queue.enqueue(
      { type: from, payload: { videoId: id }, refType: "video", refId: id },
      tx
    );
  });

  return NextResponse.json({ retried: true, from });
});
