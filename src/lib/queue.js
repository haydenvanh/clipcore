import { prisma } from "@/lib/prisma";

/**
 * Postgres-backed work queue.
 *
 * Chosen over BullMQ/Redis so that enqueueing a job and holding its credits
 * happen in one transaction — impossible across a Postgres/Redis boundary
 * without a distributed-transaction dance. It also means one datastore, one
 * bill, one thing to operate.
 *
 * `FOR UPDATE SKIP LOCKED` is the whole trick: each worker locks the rows it
 * claims and skips rows another worker already holds, so N workers never
 * collide and no job is handed out twice.
 *
 * Migration trigger, decided in advance: >50 jobs/min or >4 workers. The Job
 * row survives that move, so it is an adapter swap rather than a redesign.
 */

export const JOB_TYPES = {
  EXTRACT: "extract",
  TRANSCRIBE: "transcribe",
  ANALYZE: "analyze",
  RENDER: "render",
};

/** How long a claim is honoured before a reaper may take the job back. */
const LOCK_TIMEOUT_MS = 15 * 60 * 1000;

/** Retry backoff, in seconds, indexed by attempt number. */
const BACKOFF_SECONDS = [30, 120, 600];

function backoffFor(attempts) {
  return BACKOFF_SECONDS[Math.min(attempts, BACKOFF_SECONDS.length - 1)];
}

export const Queue = {
  /**
   * Add a job.
   *
   * Pass `tx` to enqueue inside an existing transaction — that is how a credit
   * hold and its job are committed together or not at all.
   */
  async enqueue({ type, payload, priority = 0, maxAttempts = 3, refType, refId, runAfter }, tx = prisma) {
    return tx.job.create({
      data: {
        type,
        payload,
        priority,
        maxAttempts,
        refType,
        refId,
        runAfter: runAfter ?? new Date(),
        status: "QUEUED",
      },
    });
  },

  /**
   * Claim up to `limit` runnable jobs for this worker.
   *
   * One statement, so the read and the claim cannot interleave: rows are
   * selected, locked, skipped if already locked, and marked RUNNING together.
   */
  async claim(workerId, { limit = 1, types } = {}) {
    const typeFilter = types?.length ? types : null;

    const rows = await prisma.$queryRaw`
      UPDATE "Job" AS j
         SET status = 'RUNNING',
             "lockedAt" = NOW(),
             "lockedBy" = ${workerId},
             attempts = j.attempts + 1,
             "updatedAt" = NOW()
       WHERE j.id IN (
         SELECT c.id
           FROM "Job" AS c
          WHERE c.status = 'QUEUED'
            AND c."runAfter" <= NOW()
            AND (${typeFilter}::text[] IS NULL OR c.type = ANY(${typeFilter}::text[]))
          ORDER BY c.priority DESC, c."runAfter" ASC
          LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
       )
      RETURNING j.id, j.type, j.payload, j.attempts, j."maxAttempts", j."refType", j."refId"
    `;

    return rows;
  },

  async complete(jobId) {
    return prisma.job.update({
      where: { id: jobId },
      data: { status: "SUCCEEDED", completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null },
    });
  },

  /**
   * Record a failure. Re-queues with exponential backoff while attempts
   * remain, otherwise moves the job to FAILED (the dead letter).
   *
   * @returns {Promise<{retrying: boolean, runAfter?: Date}>}
   */
  async fail(jobId, error) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return { retrying: false };

    const message = String(error?.message ?? error ?? "Unknown error").slice(0, 2000);
    const exhausted = job.attempts >= job.maxAttempts;

    if (exhausted) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "FAILED", lastError: message, completedAt: new Date(), lockedAt: null, lockedBy: null },
      });
      return { retrying: false };
    }

    const runAfter = new Date(Date.now() + backoffFor(job.attempts) * 1000);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "QUEUED", lastError: message, runAfter, lockedAt: null, lockedBy: null },
    });
    return { retrying: true, runAfter };
  },

  /**
   * Return jobs abandoned by a worker that died mid-flight.
   *
   * Without this, a crashed container's claims stay RUNNING forever and the
   * user's video silently never finishes.
   */
  async reapStale({ olderThanMs = LOCK_TIMEOUT_MS } = {}) {
    const cutoff = new Date(Date.now() - olderThanMs);

    const rows = await prisma.$queryRaw`
      UPDATE "Job"
         SET status = CASE WHEN attempts >= "maxAttempts" THEN 'FAILED'::"JobStatus" ELSE 'QUEUED'::"JobStatus" END,
             "lockedAt" = NULL,
             "lockedBy" = NULL,
             "lastError" = 'Worker stopped responding',
             "runAfter" = NOW(),
             "updatedAt" = NOW()
       WHERE status = 'RUNNING' AND "lockedAt" < ${cutoff}
      RETURNING id, status
    `;

    return rows;
  },

  /** Queue depth by status — the numbers the health check and admin page read. */
  async stats() {
    const grouped = await prisma.job.groupBy({ by: ["status"], _count: { _all: true } });
    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));

    const oldest = await prisma.job.findFirst({
      where: { status: "QUEUED", runAfter: { lte: new Date() } },
      orderBy: { runAfter: "asc" },
      select: { runAfter: true },
    });

    return {
      queued: counts.QUEUED ?? 0,
      running: counts.RUNNING ?? 0,
      failed: counts.FAILED ?? 0,
      succeeded: counts.SUCCEEDED ?? 0,
      oldestQueuedAgeMs: oldest ? Date.now() - oldest.runAfter.getTime() : 0,
    };
  },
};
