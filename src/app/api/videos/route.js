import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Queue, JOB_TYPES } from "@/lib/queue";
import { assertSafeUrl, detectSource } from "@/lib/url-guard";
import { mediaUrl } from "@/lib/storage";
import { ApiError, handler, readJson, getOwner } from "@/lib/api";

const IN_FLIGHT = ["PENDING", "EXTRACTING", "TRANSCRIBING", "ANALYZING", "RENDERING"];

/** Videos, newest first, with their clips and render state. */
export const GET = handler("VIDEOS_LIST", async (req) => {
  const owner = await getOwner();

  const params = new URL(req.url).searchParams;
  const limit = Math.min(50, Math.max(1, parseInt(params.get("limit") || "20", 10) || 20));

  const videos = await prisma.video.findMany({
    where: { userId: owner.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      clips: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          status: true,
          renders: { select: { id: true, status: true } },
        },
      },
    },
  });

  const items = await Promise.all(
    videos.map(async (video) => {
      const renders = video.clips.flatMap((clip) => clip.renders);
      return {
        id: video.id,
        title: video.title,
        sourceUrl: video.sourceUrl,
        source: video.source,
        status: video.status,
        error: video.error,
        durationSec: video.durationSec,
        createdAt: video.createdAt,
        completedAt: video.completedAt,
        thumbnailUrl: await mediaUrl(video.thumbnailKey),
        clipCount: video.clips.length,
        rendersDone: renders.filter((r) => r.status === "COMPLETED").length,
        rendersFailed: renders.filter((r) => r.status === "FAILED").length,
        rendersTotal: renders.length,
      };
    })
  );

  return NextResponse.json({ items });
});

/**
 * Start processing a video from a link.
 *
 * The Video row and its first job are written in one transaction, so a video
 * can never exist without the job that will process it — which would otherwise
 * sit in the list as "Queued" forever.
 */
export const POST = handler("VIDEOS_CREATE", async (req) => {
  const owner = await getOwner();
  const { sourceUrl, title } = await readJson(req);

  if (!sourceUrl || typeof sourceUrl !== "string") {
    throw new ApiError(400, "Paste a YouTube link.");
  }

  // Only YouTube, TikTok and Instagram hosts; rejects private addresses,
  // credentials in the URL, and non-HTTP schemes (see lib/url-guard).
  try {
    assertSafeUrl(sourceUrl.trim());
  } catch (error) {
    throw new ApiError(400, error.message);
  }
  const source = detectSource(sourceUrl.trim());
  if (!source) throw new ApiError(400, "That doesn't look like a YouTube link.");

  // Pasting the same link twice while it is still processing is almost always
  // a double-click; return the existing job rather than doing the work twice.
  const existing = await prisma.video.findFirst({
    where: { userId: owner.id, sourceUrl: sourceUrl.trim(), status: { in: IN_FLIGHT } },
    select: { id: true, status: true },
  });
  if (existing) {
    return NextResponse.json({ videoId: existing.id, status: existing.status, duplicate: true });
  }

  const video = await prisma.$transaction(async (tx) => {
    const created = await tx.video.create({
      data: {
        userId: owner.id,
        source,
        sourceUrl: sourceUrl.trim(),
        title: typeof title === "string" && title.trim() ? title.trim().slice(0, 200) : null,
        status: "PENDING",
      },
    });
    await Queue.enqueue(
      { type: JOB_TYPES.EXTRACT, payload: { videoId: created.id }, refType: "video", refId: created.id },
      tx
    );
    return created;
  });

  return NextResponse.json({ videoId: video.id, status: video.status });
});
