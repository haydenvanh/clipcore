import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Queue, JOB_TYPES } from "@/lib/queue";
import { CreditService } from "@/lib/services/credits";
import { BillingService } from "@/lib/services/billing";
import { limitsForPlan, creditsForDuration } from "@/lib/plans";
import { assertSafeUrl, detectSource } from "@/lib/url-guard";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";

/** A user's videos, newest first, with their clips and renders. */
export const GET = handler("VIDEOS_LIST", async (req) => {
  const user = await requireUser();

  const params = new URL(req.url).searchParams;
  const limit = Math.min(50, Math.max(1, parseInt(params.get("limit") || "20", 10) || 20));
  const cursor = params.get("cursor");

  const videos = await prisma.video.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      clips: {
        orderBy: { order: "asc" },
        include: {
          renders: {
            select: {
              id: true, status: true, aspectRatio: true, preset: true,
              captionStyle: true, storageKey: true, thumbnailKey: true,
            },
          },
        },
      },
    },
  });

  const hasMore = videos.length > limit;
  const items = hasMore ? videos.slice(0, limit) : videos;

  return NextResponse.json({
    // BigInt does not survive JSON.stringify, so normalize before responding.
    items: items.map((video) => ({
      ...video,
      sizeBytes: video.sizeBytes ? Number(video.sizeBytes) : null,
    })),
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
});

/**
 * Start processing a video.
 *
 * Credits are held and the job is enqueued in one transaction: if the enqueue
 * fails, the hold rolls back with it, so a user is never charged for work that
 * was never queued. That single guarantee is why the queue lives in Postgres
 * rather than Redis (docs/02-ROADMAP.md D6).
 */
export const POST = handler("VIDEOS_CREATE", async (req) => {
  const user = await requireUser();
  await enforceRateLimit("generate", user.id);

  const { sourceUrl, videoId, durationSeconds, title } = await readJson(req);

  const subscription = await BillingService.getActiveSubscription(user.id);
  const limits = limitsForPlan(subscription?.plan);

  // Concurrency is a real, non-arbitrary reason to upgrade — and it protects
  // the worker pool from one user monopolising it.
  const active = await prisma.video.count({
    where: {
      userId: user.id,
      status: { in: ["PENDING", "EXTRACTING", "TRANSCRIBING", "ANALYZING", "RENDERING"] },
    },
  });
  if (active >= limits.maxConcurrentJobs) {
    throw new ApiError(
      429,
      `Your ${limits.name} plan processes ${limits.maxConcurrentJobs} video${limits.maxConcurrentJobs > 1 ? "s" : ""} at a time. Wait for one to finish, or upgrade.`
    );
  }

  let video;

  if (videoId) {
    // The upload path: the row already exists from /api/uploads/presign.
    video = await prisma.video.findFirst({ where: { id: videoId, userId: user.id } });
    if (!video) throw new ApiError(404, "Upload not found.");
    if (video.status !== "PENDING") throw new ApiError(409, "That video is already processing.");
  } else {
    if (!sourceUrl) throw new ApiError(400, "A video URL or an uploaded file is required.");

    // Strict allowlist: YouTube, TikTok, Instagram. Rejects private addresses,
    // credentials in the URL, and non-HTTP schemes.
    assertSafeUrl(sourceUrl);
    const source = detectSource(sourceUrl);
    if (!source) throw new ApiError(400, "Paste a YouTube, TikTok, or Instagram link.");

    if (source !== "YOUTUBE") {
      throw new ApiError(
        501,
        `${source.charAt(0)}${source.slice(1).toLowerCase()} links are coming soon. YouTube links and file uploads work today.`
      );
    }

    video = await prisma.video.create({
      data: {
        userId: user.id,
        source,
        sourceUrl,
        title: typeof title === "string" ? title.slice(0, 200) : null,
        durationSec: Number.isFinite(Number(durationSeconds)) ? Math.round(Number(durationSeconds)) : null,
        status: "PENDING",
        provider: "native",
      },
    });
  }

  // Charged per minute of source. Duration is an estimate until the worker
  // probes the real file, at which point the hold is settled against it.
  const estimatedMinutes = video.durationSec
    ? creditsForDuration(video.durationSec)
    : creditsForDuration(600); // nominal 10 minutes when the length is unknown

  if (video.durationSec && video.durationSec > limits.maxVideoMinutes * 60) {
    throw new ApiError(
      413,
      `Your ${limits.name} plan handles videos up to ${limits.maxVideoMinutes} minutes.`
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await CreditService.hold(user.id, estimatedMinutes, {
        refType: "video",
        refId: video.id,
        description: `Processing ${video.title || "video"}`,
      });
      await tx.video.update({
        where: { id: video.id },
        data: { creditsHeld: estimatedMinutes, status: "PENDING" },
      });
      await Queue.enqueue(
        { type: JOB_TYPES.EXTRACT, payload: { videoId: video.id }, refType: "video", refId: video.id },
        tx
      );
    });
  } catch (error) {
    if (error.name === "InsufficientCreditsError") {
      throw new ApiError(
        402,
        `This video needs about ${estimatedMinutes} credits and you have ${error.available}. Top up to continue.`
      );
    }
    throw error;
  }

  return NextResponse.json({
    videoId: video.id,
    status: "PENDING",
    creditsHeld: estimatedMinutes,
  });
});
