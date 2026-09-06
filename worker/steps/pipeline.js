import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "../lib/db.js";
import * as storage from "../lib/storage.js";
import { probe, downloadSource, normalize, extractAudio, thumbnail, renderClip } from "../lib/ffmpeg.js";
import { transcribe } from "../lib/transcribe.js";
import { analyzeTranscript } from "../lib/analyze.js";
import { buildAss } from "../lib/captions.js";

/**
 * The five pipeline steps, one exported function each.
 *
 * Each step is a separate Job so a failure retries only the work that failed —
 * a caption render that dies does not re-download and re-transcribe an hour of
 * audio. Every step is idempotent: a retry after a partial success overwrites
 * its own output rather than duplicating rows.
 */

/** Per-job scratch directory, always removed. */
async function withTempDir(prefix, fn) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  try {
    return await fn(dir);
  } finally {
    // A leaked temp dir holding a 2 GB video fills the container's disk and
    // takes down every later job, so this must run on failure too.
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Credits are held on an estimate; this settles against the real duration. */
async function settleCredits(video, actualDurationSec, CreditService) {
  const actual = Math.max(1, Math.ceil(actualDurationSec / 60));
  if (video.creditsHeld === actual) return;
  await CreditService.settle(video.userId, video.creditsHeld, actual, {
    refType: "video",
    refId: video.id,
  });
}

/**
 * Step 1 — get the source video and normalize it.
 *
 * Uploads already sit in R2; links are fetched with yt-dlp. Either way the
 * output is one normalized MP4 in our bucket with known duration, which is
 * what every later step assumes.
 */
export async function extract({ videoId }, { CreditService }) {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) throw new Error(`Video ${videoId} not found`);

  await prisma.video.update({ where: { id: videoId }, data: { status: "EXTRACTING" } });

  return withTempDir("extract", async (dir) => {
    const rawPath = path.join(dir, "raw.mp4");

    if (video.source === "UPLOAD") {
      if (!video.storageKey) throw new Error("Upload has no stored object");
      await storage.download(video.storageKey, rawPath);
    } else {
      if (!video.sourceUrl) throw new Error("No source URL");
      await downloadSource(video.sourceUrl, rawPath);
    }

    const rawInfo = await probe(rawPath);
    if (!rawInfo.hasAudio) {
      throw new Error("This video has no audio track, so there is nothing to transcribe.");
    }

    const normalizedPath = path.join(dir, "normalized.mp4");
    await normalize(rawPath, normalizedPath);
    const info = await probe(normalizedPath);

    const key = storage.keys.source(video.userId, video.id);
    await storage.upload(normalizedPath, key, "video/mp4");

    const thumbPath = path.join(dir, "thumb.jpg");
    await thumbnail(normalizedPath, thumbPath, { atSeconds: Math.min(3, info.durationSec / 2) });
    const thumbKey = storage.keys.sourceThumb(video.userId, video.id);
    await storage.upload(thumbPath, thumbKey, "image/jpeg");

    await prisma.video.update({
      where: { id: videoId },
      data: {
        storageKey: key,
        thumbnailKey: thumbKey,
        durationSec: Math.round(info.durationSec),
        sizeBytes: BigInt(Math.round(info.sizeBytes)),
        width: info.width,
        height: info.height,
        status: "TRANSCRIBING",
      },
    });

    // Now that the true duration is known, charge for what we will actually do.
    await settleCredits(video, info.durationSec, CreditService);

    return { videoId, durationSec: info.durationSec };
  });
}

/** Step 2 — transcribe with word-level timings. */
export async function transcribeStep({ videoId }) {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video?.storageKey) throw new Error(`Video ${videoId} has no source`);

  await prisma.video.update({ where: { id: videoId }, data: { status: "TRANSCRIBING" } });

  return withTempDir("transcribe", async (dir) => {
    const videoPath = path.join(dir, "source.mp4");
    const audioPath = path.join(dir, "audio.wav");

    await storage.download(video.storageKey, videoPath);
    await extractAudio(videoPath, audioPath);

    const result = await transcribe(audioPath);
    if (result.words.length === 0) {
      throw new Error("No speech was detected in this video.");
    }

    const key = storage.keys.transcript(videoId);
    await storage.uploadText(JSON.stringify(result), key, "application/json");

    // upsert, not create: a retry after a partial success must not collide with
    // the unique constraint on videoId.
    await prisma.transcript.upsert({
      where: { videoId },
      create: {
        videoId,
        language: result.language,
        text: result.text.slice(0, 1_000_000),
        words: result.words,
        storageKey: key,
        model: process.env.WHISPER_MODEL || "whisper-1",
      },
      update: {
        language: result.language,
        text: result.text.slice(0, 1_000_000),
        words: result.words,
        storageKey: key,
      },
    });

    await prisma.video.update({ where: { id: videoId }, data: { status: "ANALYZING" } });

    return { videoId, wordCount: result.words.length, language: result.language };
  });
}

/** Step 3 — find and score the moments worth clipping. */
export async function analyze({ videoId, targetCount = 10 }) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { transcript: true },
  });
  if (!video?.transcript) throw new Error(`Video ${videoId} has no transcript`);

  await prisma.video.update({ where: { id: videoId }, data: { status: "ANALYZING" } });

  const words = Array.isArray(video.transcript.words) ? video.transcript.words : [];
  const moments = await analyzeTranscript(words, {
    videoDuration: video.durationSec ?? 0,
    targetCount,
  });

  if (moments.length === 0) {
    throw new Error("No clip-worthy moments were found in this video.");
  }

  // Replace rather than append, so a retry does not duplicate clips.
  await prisma.clip.deleteMany({ where: { videoId } });

  const clips = await prisma.$transaction(
    moments.map((moment, index) =>
      prisma.clip.create({
        data: {
          videoId,
          userId: video.userId,
          startSec: moment.startSec,
          endSec: moment.endSec,
          title: moment.title,
          summary: moment.summary,
          hook: moment.hook,
          reasoning: moment.reasoning,
          viralScore: moment.viralScore,
          clipScore: moment.clipScore,
          confidence: moment.confidence,
          signals: moment.signals,
          order: index,
          status: "PENDING",
        },
      })
    )
  );

  await prisma.video.update({ where: { id: videoId }, data: { status: "RENDERING" } });

  return { videoId, clipIds: clips.map((c) => c.id) };
}

/** Step 4+5 — cut, reframe, and burn captions for one render. */
export async function render({ renderId }) {
  const renderRow = await prisma.render.findUnique({
    where: { id: renderId },
    include: { clip: { include: { video: { include: { transcript: true } } } } },
  });
  if (!renderRow) throw new Error(`Render ${renderId} not found`);

  const { clip } = renderRow;
  const { video } = clip;
  if (!video.storageKey) throw new Error("Source video is not available");

  await prisma.render.update({ where: { id: renderId }, data: { status: "RENDERING" } });
  await prisma.clip.update({ where: { id: clip.id }, data: { status: "RENDERING" } });

  return withTempDir("render", async (dir) => {
    const sourcePath = path.join(dir, "source.mp4");
    await storage.download(video.storageKey, sourcePath);

    let subtitlePath = null;
    let captionKey = null;

    if (renderRow.captionStyle !== "NONE" && video.transcript) {
      const words = Array.isArray(video.transcript.words) ? video.transcript.words : [];
      const ass = buildAss(words, {
        style: renderRow.captionStyle,
        aspectRatio: renderRow.aspectRatio,
        clipStart: clip.startSec,
        clipEnd: clip.endSec,
      });

      subtitlePath = path.join(dir, "captions.ass");
      await fs.promises.writeFile(subtitlePath, ass, "utf8");

      captionKey = storage.keys.captions(clip.id, renderRow.captionLang);
      await storage.uploadText(ass, captionKey, "text/plain");
    }

    const outputPath = path.join(dir, "clip.mp4");
    await renderClip({
      inputPath: sourcePath,
      outputPath,
      startSec: clip.startSec,
      endSec: clip.endSec,
      aspectRatio: renderRow.aspectRatio,
      subtitlePath,
    });

    const info = await probe(outputPath);
    const key = storage.keys.clip(renderRow.userId, clip.id, renderId);
    const { size } = await storage.upload(outputPath, key, "video/mp4");

    const thumbPath = path.join(dir, "thumb.jpg");
    await thumbnail(outputPath, thumbPath, { atSeconds: Math.min(1, info.durationSec / 2) });
    const thumbKey = storage.keys.clipThumb(renderRow.userId, clip.id, renderId);
    await storage.upload(thumbPath, thumbKey, "image/jpeg");

    await prisma.render.update({
      where: { id: renderId },
      data: {
        storageKey: key,
        thumbnailKey: thumbKey,
        captionKey,
        width: info.width,
        height: info.height,
        sizeBytes: BigInt(size),
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    await prisma.clip.update({ where: { id: clip.id }, data: { status: "COMPLETED" } });

    // The video is done when nothing is left rendering.
    const outstanding = await prisma.render.count({
      where: { clip: { videoId: video.id }, status: { in: ["PENDING", "RENDERING"] } },
    });
    if (outstanding === 0) {
      await prisma.video.update({
        where: { id: video.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }

    return { renderId, key, sizeBytes: size };
  });
}
