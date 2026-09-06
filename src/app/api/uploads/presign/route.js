import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createUploadUrl, ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { BillingService } from "@/lib/services/billing";
import { limitsForPlan } from "@/lib/plans";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";

/**
 * Issue a presigned PUT so the browser uploads straight to R2.
 *
 * Replaces the old /api/upload, which proxied the whole file through a
 * serverless function — and which threw on every call anyway, because it read
 * an API key (`config.ai.headshot`) that did not exist.
 *
 * A Video row is created up front so the key we sign is already owned by
 * someone; an upload that never completes leaves a PENDING row we can reap.
 */
export const POST = handler("UPLOAD_PRESIGN", async (req) => {
  const user = await requireUser();

  const { contentType, contentLength, filename, durationSeconds } = await readJson(req);

  if (!contentType || !ALLOWED_UPLOAD_TYPES.has(contentType)) {
    throw new ApiError(
      415,
      `Unsupported file type. Upload MP4, MOV, MKV, WebM, or an audio file.`
    );
  }

  const size = Number(contentLength);
  if (!Number.isFinite(size) || size <= 0) {
    throw new ApiError(400, "A valid file size is required.");
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, "That file is larger than the 2 GB limit.");
  }

  // Enforce the plan's video-length cap before we hand out an upload URL,
  // rather than after the user has waited for a 2 GB upload to finish.
  const subscription = await BillingService.getActiveSubscription(user.id);
  const limits = limitsForPlan(subscription?.plan);
  const duration = Number(durationSeconds);

  if (Number.isFinite(duration) && duration > limits.maxVideoMinutes * 60) {
    throw new ApiError(
      413,
      `Your ${limits.name} plan handles videos up to ${limits.maxVideoMinutes} minutes. Upgrade for longer videos.`
    );
  }

  const video = await prisma.video.create({
    data: {
      userId: user.id,
      source: "UPLOAD",
      title: typeof filename === "string" ? filename.slice(0, 200) : null,
      durationSec: Number.isFinite(duration) ? Math.round(duration) : null,
      sizeBytes: BigInt(Math.round(size)),
      status: "PENDING",
    },
  });

  const { uploadUrl, key, expiresIn } = await createUploadUrl({
    userId: user.id,
    videoId: video.id,
    contentType,
    contentLength: size,
  });

  await prisma.video.update({ where: { id: video.id }, data: { storageKey: key } });

  return NextResponse.json({
    videoId: video.id,
    uploadUrl,
    key,
    expiresIn,
    // The browser must send exactly this header or the signature will not match.
    headers: { "Content-Type": contentType },
  });
});
