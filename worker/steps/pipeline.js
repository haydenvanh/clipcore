import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "../lib/db.js";
import * as storage from "../lib/storage.js";
import { probe, downloadSource, normalize, extractAudioChunk, thumbnail, renderClip } from "../lib/ffmpeg.js";
import {
  transcribeWithRetry, planChunks, mergeChunkResults, isTranscriptionConfigured,
} from "../lib/transcribe.js";
import { analyzeTranscript } from "../lib/analyze.js";
import { buildAss } from "../lib/captions.js";
import { PermanentError, classifyDownloadError } from "../lib/errors.js";

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

/**
 * Step 1 — get the source video and normalize it.
 *
 * Uploads are already in storage; links are fetched with yt-dlp. Either way
 * the output is one normalized MP4 with a known duration, which is what every
 * later step assumes.
 */
export async function extract({ videoId }) {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) throw new Error(`Video ${videoId} not found`);

  await prisma.video.update({ where: { id: videoId }, data: { status: "EXTRACTING" } });

  return withTempDir("extract", async (dir) => {
    const rawPath = path.join(dir, "raw.mp4");
    let fetchedTitle = null;

    if (video.source === "UPLOAD") {
      if (!video.storageKey) throw new Error("Upload has no stored object");
      await storage.download(video.storageKey, rawPath);
    } else {
      if (!video.sourceUrl) throw new PermanentError("This video has no source link.");
      try {
        ({ title: fetchedTitle } = await downloadSource(video.sourceUrl, rawPath));
      } catch (error) {
        throw classifyDownloadError(error);
      }
    }

    const rawInfo = await probe(rawPath);
    if (!rawInfo.hasAudio) {
      throw new PermanentError("This video has no audio track, so there is nothing to transcribe.");
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
        // Keep a title the user set; otherwise use the one YouTube reports.
        ...(video.title ? {} : fetchedTitle ? { title: fetchedTitle.slice(0, 200) } : {}),
        durationSec: Math.round(info.durationSec),
        sizeBytes: BigInt(Math.round(info.sizeBytes)),
        width: info.width,
        height: info.height,
        status: "TRANSCRIBING",
      },
    });

    return { videoId, durationSec: info.durationSec };
  });
}

/** Run async work over items with at most `limit` in flight. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(lanes);
  return results;
}

/**
 * Step 2 — transcribe with word-level timings.
 *
 * The audio is sent in ten-minute slices rather than as one file: the Whisper
 * API rejects uploads over 25 MB, which an uncompressed track reaches at about
 * 13 minutes. The first slice runs alone to detect the language, and the rest
 * run three at a time with that language pinned, so a slice that happens to be
 * mostly music is not transcribed as the wrong language.
 */
export async function transcribeStep({ videoId }) {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video?.storageKey) throw new Error(`Video ${videoId} has no source`);

  if (!isTranscriptionConfigured()) {
    // Fail with a message that names the fix, not an HTTP 401 from OpenAI.
    throw new PermanentError("OPENAI_API_KEY is not set in .env, so the audio cannot be transcribed.");
  }

  await prisma.video.update({ where: { id: videoId }, data: { status: "TRANSCRIBING" } });

  return withTempDir("transcribe", async (dir) => {
    const videoPath = path.join(dir, "source.mp4");
    await storage.download(video.storageKey, videoPath);

    const durationSec = video.durationSec || (await probe(videoPath)).durationSec;
    const chunks = planChunks(durationSec);

    const transcribeChunk = async (chunk, language) => {
      const audioPath = path.join(dir, `chunk-${String(chunk.index).padStart(3, "0")}.mp3`);
      await extractAudioChunk(videoPath, audioPath, chunk);
      const result = await transcribeWithRetry(audioPath, language ? { language } : {});
      await fs.promises.rm(audioPath, { force: true });
      return { startSec: chunk.startSec, result };
    };

    const [first, ...rest] = chunks;
    const firstResult = await transcribeChunk(first);
    const language = firstResult.result.language;
    const restResults = await mapLimit(rest, 3, (chunk) => transcribeChunk(chunk, language));

    const result = mergeChunkResults([firstResult, ...restResults]);
    if (result.words.length === 0) {
      throw new PermanentError("No speech was detected in this video.");
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

    return { videoId, wordCount: result.words.length, language: result.language, chunks: chunks.length };
  });
}

/** Step 3 — find and score the moments worth clipping. */
export async function analyze({ videoId, targetCount = 10 }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Fail with a message that names the fix rather than an SDK auth error.
    throw new PermanentError("ANTHROPIC_API_KEY is not set in .env, so clips cannot be selected.");
  }

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
    throw new PermanentError("No clip-worthy moments were found in this video.");
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
