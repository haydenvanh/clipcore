import { randomUUID } from "node:crypto";
import { prisma, disconnect } from "./lib/db.js";
import { extract, transcribeStep, analyze, render } from "./steps/pipeline.js";
import { publish } from "./steps/publish.js";
import { CreditService } from "./lib/credits.js";

/**
 * The worker loop.
 *
 * Claims jobs from the Postgres queue with FOR UPDATE SKIP LOCKED, runs the
 * matching step, and chains the next stage. Runs as a long-lived container
 * (Railway/Render) because Vercel functions cannot ship ffmpeg, have no
 * persistent disk, and time out long before a 3-hour podcast is transcoded.
 */

const WORKER_ID = `${process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || "worker"}-${randomUUID().slice(0, 8)}`;
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 2);
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_MS || 2000);
const REAP_INTERVAL_MS = 60_000;
const LOCK_TIMEOUT_MS = 15 * 60 * 1000;
const BACKOFF_SECONDS = [30, 120, 600];

let running = true;
let inFlight = 0;

function log(level, message, fields = {}) {
  // One JSON object per line: greppable locally, and parsed as structured
  // fields by every log platform without a custom parser.
  console[level === "error" ? "error" : "log"](
    JSON.stringify({ ts: new Date().toISOString(), level, worker: WORKER_ID, message, ...fields })
  );
}

/** Claim runnable jobs. One statement, so two workers cannot take the same row. */
async function claim(limit) {
  return prisma.$queryRaw`
    UPDATE "Job" AS j
       SET status = 'RUNNING',
           "lockedAt" = NOW(),
           "lockedBy" = ${WORKER_ID},
           attempts = j.attempts + 1,
           "updatedAt" = NOW()
     WHERE j.id IN (
       SELECT c.id FROM "Job" AS c
        WHERE c.status = 'QUEUED' AND c."runAfter" <= NOW()
        ORDER BY c.priority DESC, c."runAfter" ASC
        LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
     )
    RETURNING j.id, j.type, j.payload, j.attempts, j."maxAttempts"
  `;
}

/**
 * Run one job and queue whatever comes next.
 *
 * Each stage enqueues its successor rather than one long function, so a
 * caption render that fails retries only the render — it does not re-download
 * and re-transcribe an hour of audio.
 */
async function execute(job) {
  const started = Date.now();
  log("info", "job.start", { jobId: job.id, type: job.type, attempt: job.attempts });

  switch (job.type) {
    case "extract": {
      const result = await extract(job.payload, { CreditService });
      await enqueue("transcribe", { videoId: result.videoId }, "video", result.videoId);
      return result;
    }

    case "transcribe": {
      const result = await transcribeStep(job.payload);
      await enqueue("analyze", { videoId: result.videoId }, "video", result.videoId);
      return result;
    }

    case "analyze": {
      const result = await analyze(job.payload);
      // Fan out: one render job per clip, so they can run in parallel and fail
      // independently.
      for (const clipId of result.clipIds) {
        const renderRow = await createDefaultRender(clipId);
        await enqueue("render", { renderId: renderRow.id }, "render", renderRow.id);
      }
      return result;
    }

    case "render":
      return render(job.payload);

    case "publish":
      return publish(job.payload);

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

/** The default export every clip gets: vertical, karaoke captions. */
async function createDefaultRender(clipId) {
  const clip = await prisma.clip.findUnique({ where: { id: clipId } });
  return prisma.render.upsert({
    where: {
      clipId_aspectRatio_preset_captionStyle_captionLang: {
        clipId,
        aspectRatio: "RATIO_9_16",
        preset: "TIKTOK",
        captionStyle: "KARAOKE",
        captionLang: "en",
      },
    },
    create: {
      clipId,
      userId: clip.userId,
      aspectRatio: "RATIO_9_16",
      preset: "TIKTOK",
      captionStyle: "KARAOKE",
      captionLang: "en",
      status: "PENDING",
    },
    update: {},
  });
}

async function enqueue(type, payload, refType, refId) {
  return prisma.job.create({
    data: { type, payload, refType, refId, status: "QUEUED", runAfter: new Date() },
  });
}

async function complete(jobId) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "SUCCEEDED", completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null },
  });
}

/** Re-queue with backoff, or dead-letter once attempts are exhausted. */
async function fail(job, error) {
  const message = String(error?.message ?? error).slice(0, 2000);
  const exhausted = job.attempts >= job.maxAttempts;

  if (exhausted) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "FAILED", lastError: message, completedAt: new Date(), lockedAt: null, lockedBy: null },
    });
    await markSubjectFailed(job, message);
    log("error", "job.dead", { jobId: job.id, type: job.type, error: message });
    return;
  }

  const delay = BACKOFF_SECONDS[Math.min(job.attempts - 1, BACKOFF_SECONDS.length - 1)];
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: "QUEUED",
      lastError: message,
      runAfter: new Date(Date.now() + delay * 1000),
      lockedAt: null,
      lockedBy: null,
    },
  });
  log("warn", "job.retry", { jobId: job.id, type: job.type, inSeconds: delay, error: message });
}

/**
 * Surface a dead job to the user and return their credits.
 *
 * A job that quietly disappears from the queue while the UI spins forever is
 * worse than an error message, and charging for work we did not deliver is
 * worse still.
 */
async function markSubjectFailed(job, message) {
  try {
    if (job.refType === "video" && job.refId) {
      const video = await prisma.video.findUnique({ where: { id: job.refId } });
      if (video && video.status !== "FAILED") {
        await prisma.video.update({
          where: { id: job.refId },
          data: { status: "FAILED", error: message },
        });
        if (video.creditsHeld > 0) {
          await CreditService.refund(video.userId, video.creditsHeld, {
            refType: "video",
            refId: video.id,
            description: "Processing failed",
          });
        }
      }
    } else if (job.refType === "render" && job.refId) {
      await prisma.render.update({
        where: { id: job.refId },
        data: { status: "FAILED", error: message },
      });
    }
  } catch (error) {
    log("error", "job.cleanup_failed", { jobId: job.id, error: error.message });
  }
}

/** Return jobs held by a worker that died mid-flight. */
async function reapStale() {
  const cutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const rows = await prisma.$queryRaw`
    UPDATE "Job"
       SET status = CASE WHEN attempts >= "maxAttempts" THEN 'FAILED'::"JobStatus" ELSE 'QUEUED'::"JobStatus" END,
           "lockedAt" = NULL, "lockedBy" = NULL,
           "lastError" = 'Worker stopped responding',
           "runAfter" = NOW(), "updatedAt" = NOW()
     WHERE status = 'RUNNING' AND "lockedAt" < ${cutoff}
    RETURNING id
  `;
  if (rows.length > 0) log("warn", "jobs.reaped", { count: rows.length });
}

async function tick() {
  const capacity = CONCURRENCY - inFlight;
  if (capacity <= 0) return;

  const jobs = await claim(capacity);

  for (const job of jobs) {
    inFlight++;
    execute(job)
      .then(async (result) => {
        await complete(job.id);
        log("info", "job.done", { jobId: job.id, type: job.type, ...result });
      })
      .catch((error) => fail(job, error))
      .finally(() => {
        inFlight--;
      });
  }
}

async function main() {
  log("info", "worker.start", { concurrency: CONCURRENCY });

  const reaper = setInterval(() => reapStale().catch((e) => log("error", "reap.failed", { error: e.message })), REAP_INTERVAL_MS);

  const shutdown = async (signal) => {
    if (!running) return;
    running = false;
    log("info", "worker.shutdown", { signal, inFlight });
    clearInterval(reaper);

    // Let in-flight jobs finish rather than orphaning them for the reaper.
    const deadline = Date.now() + 30_000;
    while (inFlight > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
    }
    await disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  while (running) {
    try {
      await tick();
    } catch (error) {
      log("error", "tick.failed", { error: error.message });
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((error) => {
  log("error", "worker.fatal", { error: error.message, stack: error.stack });
  process.exit(1);
});
