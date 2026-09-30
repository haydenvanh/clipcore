import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handler, readJson, getOwner } from "@/lib/api";

/** The word timings behind the captions editor. */
export const GET = handler("TRANSCRIPT_GET", async (req, ctx) => {
  const user = await getOwner();
  const { id } = await ctx.params;

  const video = await prisma.video.findFirst({
    where: { id, userId: user.id },
    include: { transcript: true, clips: { orderBy: { order: "asc" }, select: { id: true, title: true, startSec: true, endSec: true } } },
  });
  if (!video) throw new ApiError(404, "Video not found.");
  if (!video.transcript) throw new ApiError(409, "This video has not been transcribed yet.");

  return NextResponse.json({
    videoId: video.id,
    language: video.transcript.language,
    edited: video.transcript.edited,
    words: Array.isArray(video.transcript.words) ? video.transcript.words : [],
    clips: video.clips,
    durationSec: video.durationSec,
  });
});

const MAX_WORDS = 200_000;

/**
 * Save corrected words and timings.
 *
 * Validated strictly, because these values end up in an ASS file that ffmpeg
 * parses: a NaN timestamp or a reordered array produces captions that flash,
 * overlap, or crash the filter graph. Rejecting a bad payload is far better
 * than rendering a broken clip and charging for it.
 */
export const PATCH = handler("TRANSCRIPT_UPDATE", async (req, ctx) => {
  const user = await getOwner();
  const { id } = await ctx.params;

  const video = await prisma.video.findFirst({
    where: { id, userId: user.id },
    include: { transcript: { select: { id: true } } },
  });
  if (!video) throw new ApiError(404, "Video not found.");
  if (!video.transcript) throw new ApiError(409, "This video has not been transcribed yet.");

  const { words } = await readJson(req);
  if (!Array.isArray(words)) throw new ApiError(400, "words must be an array.");
  if (words.length > MAX_WORDS) throw new ApiError(413, "That transcript is too large to save.");

  const duration = video.durationSec ?? Infinity;
  const cleaned = [];

  for (const [index, word] of words.entries()) {
    const text = typeof word?.w === "string" ? word.w.trim() : "";
    const start = Number(word?.start);
    const end = Number(word?.end);

    if (!text) continue; // deleting a word is a legitimate edit
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new ApiError(400, `Word ${index + 1} has an invalid timestamp.`);
    }
    if (end <= start) {
      throw new ApiError(400, `Word ${index + 1} ends before it starts.`);
    }
    if (start < 0 || end > duration + 1) {
      throw new ApiError(400, `Word ${index + 1} falls outside the video.`);
    }
    if (text.length > 200) {
      throw new ApiError(400, `Word ${index + 1} is too long.`);
    }

    cleaned.push({ w: text.slice(0, 200), start, end });
  }

  // Captions are rendered in array order; an out-of-order array would produce
  // cues that jump backwards.
  cleaned.sort((a, b) => a.start - b.start);

  const updated = await prisma.transcript.update({
    where: { videoId: video.id },
    data: {
      words: cleaned,
      text: cleaned.map((w) => w.w).join(" ").slice(0, 1_000_000),
      edited: true,
      editedAt: new Date(),
    },
    select: { edited: true, editedAt: true },
  });

  return NextResponse.json({ saved: true, wordCount: cleaned.length, ...updated });
});
