import * as storage from "./storage.js";

/**
 * Disk housekeeping for downloaded originals.
 *
 * The original is by far the biggest file a video leaves behind — a 2-hour
 * podcast at 1080p is ~2 GB, its clips together a few hundred MB — and it is
 * only needed while processing, or to retry a failed render. So:
 *
 * - every clip rendered:   delete the original at once;
 * - some clips failed:     keep it for RETRY_WINDOW_DAYS so Retry still works,
 *                          then the sweep deletes it.
 *
 * Clips, thumbnails, and the transcript are always kept.
 */

export const RETRY_WINDOW_DAYS = 7;

/** Keep at least this much disk free before starting a new download. */
export const MIN_FREE_BYTES = 2 * 1024 ** 3;

/** Delete a video's original and record that it's gone. Safe to call twice. */
export async function deleteSource(prisma, video) {
  if (!video.storageKey || video.sourceDeletedAt) return false;
  await storage.remove(video.storageKey);
  await prisma.video.update({ where: { id: video.id }, data: { sourceDeletedAt: new Date() } });
  return true;
}

/** After a video's renders settle: delete the original if nothing needs a retry. */
export async function deleteSourceIfDone(prisma, videoId) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, storageKey: true, sourceDeletedAt: true, clips: { select: { renders: { select: { status: true } } } } },
  });
  if (!video) return false;
  const renders = video.clips.flatMap((clip) => clip.renders);
  const allDone = renders.length > 0 && renders.every((r) => r.status === "COMPLETED");
  return allDone ? deleteSource(prisma, video) : false;
}

/** Delete originals of finished or failed videos older than the retry window. */
export async function sweepOldSources(prisma, now = new Date()) {
  const cutoff = new Date(now.getTime() - RETRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const stale = await prisma.video.findMany({
    where: {
      storageKey: { not: null },
      sourceDeletedAt: null,
      status: { in: ["COMPLETED", "FAILED", "CANCELED"] },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, storageKey: true, sourceDeletedAt: true },
    take: 200,
  });
  let deleted = 0;
  for (const video of stale) if (await deleteSource(prisma, video)) deleted++;
  return deleted;
}
