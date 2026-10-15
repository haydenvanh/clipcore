import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Queue, JOB_TYPES } from "@/lib/queue";
import { ApiError, handler, requireUser } from "@/lib/api";
import { assertCanStartVideo } from "@/lib/video-limits";
import { keys, writeStream, deleteObject, freeBytes, extensionForType } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Largest file accepted. */
const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;
/** Disk to leave free after an upload, so processing has room to work. */
const HEADROOM_BYTES = 2 * 1024 ** 3;

const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-matroska", "video/webm", "video/x-msvideo"]);

/** A web stream that errors once more than `limit` bytes pass through. */
function capped(stream, limit) {
  let seen = 0;
  return stream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > limit) controller.error(new ApiError(413, "That file is over 2 GB."));
        else controller.enqueue(chunk);
      },
    })
  );
}

/**
 * Upload a video file to make clips from.
 *
 * The body is the raw file, streamed straight to disk — never held in memory.
 * Headers: Content-Type (the file's type), Content-Length, and X-File-Name.
 * Then it's queued exactly like a pasted link.
 */
export const POST = handler("VIDEOS_UPLOAD", async (req) => {
  const user = await requireUser();

  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!VIDEO_TYPES.has(type)) throw new ApiError(415, "Upload a video file: MP4, MOV, MKV, WebM, or AVI.");

  const size = Number(req.headers.get("content-length"));
  if (!Number.isFinite(size) || size <= 0) throw new ApiError(411, "The upload had no size.");
  if (size > MAX_UPLOAD_BYTES) throw new ApiError(413, "That file is over 2 GB.");
  if (!req.body) throw new ApiError(400, "The upload was empty.");

  const { plan } = await assertCanStartVideo(user.id);

  if ((await freeBytes()) < size + HEADROOM_BYTES) {
    console.error("[VIDEOS_UPLOAD] disk.low");
    throw new ApiError(507, "ClipCore is out of processing space right now. Please try again in a little while.");
  }

  const rawName = decodeURIComponent(req.headers.get("x-file-name") || "");
  const title = rawName.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || null;

  const video = await prisma.video.create({
    data: { userId: user.id, source: "UPLOAD", title, status: "PENDING" },
  });
  const key = keys.upload(user.id, video.id, extensionForType(type));

  try {
    await writeStream(key, capped(req.body, MAX_UPLOAD_BYTES));
  } catch (error) {
    // A cancelled or oversized upload leaves nothing behind.
    await deleteObject(key).catch(() => {});
    await prisma.video.delete({ where: { id: video.id } }).catch(() => {});
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "The upload didn't finish. Please try again.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.video.update({ where: { id: video.id }, data: { storageKey: key } });
    await Queue.enqueue(
      { type: JOB_TYPES.EXTRACT, payload: { videoId: video.id }, priority: plan.priority, refType: "video", refId: video.id },
      tx
    );
  });

  return NextResponse.json({ videoId: video.id, status: "PENDING" });
});
