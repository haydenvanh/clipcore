import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createDownloadUrl } from "@/lib/storage";
import { ApiError, handler, requireUser } from "@/lib/api";

/**
 * Hand back a short-lived signed URL for one of the caller's own objects.
 *
 * Ownership is resolved from the database rather than trusted from the
 * request: the client sends a render id, never a raw object key, so no caller
 * can ask us to sign an arbitrary path.
 */
export const GET = handler("MEDIA_DOWNLOAD", async (req) => {
  const user = await requireUser();

  const params = new URL(req.url).searchParams;
  const renderId = params.get("renderId");
  const videoId = params.get("videoId");

  if (!renderId && !videoId) {
    throw new ApiError(400, "A renderId or videoId is required.");
  }

  let storageKey = null;
  let filename = "clip.mp4";

  if (renderId) {
    const render = await prisma.render.findFirst({
      where: { id: renderId, userId: user.id },
      include: { clip: { select: { title: true } } },
    });
    if (!render) throw new ApiError(404, "Clip not found.");
    if (!render.storageKey) throw new ApiError(409, "That clip is still rendering.");

    storageKey = render.storageKey;
    const base = (render.clip?.title || "clip").replace(/[^\w\- ]+/g, "").trim() || "clip";
    filename = `${base}.mp4`;
  } else {
    const video = await prisma.video.findFirst({
      where: { id: videoId, userId: user.id },
      select: { storageKey: true, title: true },
    });
    if (!video) throw new ApiError(404, "Video not found.");
    if (!video.storageKey) throw new ApiError(409, "That video is still uploading.");

    storageKey = video.storageKey;
    filename = `${(video.title || "video").replace(/[^\w\- ]+/g, "").trim() || "video"}.mp4`;
  }

  const url = await createDownloadUrl(storageKey, { expiresIn: 3600, filename });
  return NextResponse.json({ url, expiresIn: 3600 });
});
