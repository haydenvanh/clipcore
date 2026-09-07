import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness and queue depth, for uptime monitoring and alerting.
 *
 * Deliberately unauthenticated so a monitor can reach it, and deliberately
 * free of version numbers, connection strings, and error details — a public
 * health endpoint should not double as reconnaissance.
 *
 * Returns 503 when the database is unreachable or the queue is backed up, so a
 * monitor alerts without needing to parse the body.
 */

const QUEUE_DEPTH_ALERT = Number(process.env.HEALTH_QUEUE_ALERT || 50);

export async function GET() {
  const startedAt = Date.now();
  const checks = {};
  let healthy = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - startedAt };
  } catch {
    checks.database = { ok: false };
    healthy = false;
  }

  if (checks.database.ok) {
    try {
      const grouped = await prisma.job.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: { status: { in: ["QUEUED", "RUNNING", "FAILED"] } },
      });
      const counts = Object.fromEntries(grouped.map((r) => [r.status, r._count._all]));

      const oldest = await prisma.job.findFirst({
        where: { status: "QUEUED", runAfter: { lte: new Date() } },
        orderBy: { runAfter: "asc" },
        select: { runAfter: true },
      });

      const queued = counts.QUEUED ?? 0;
      checks.queue = {
        // A backlog means the worker is down or starved — user-visible as
        // videos that never finish, so it fails the health check.
        ok: queued < QUEUE_DEPTH_ALERT,
        queued,
        running: counts.RUNNING ?? 0,
        failed: counts.FAILED ?? 0,
        oldestWaitingMs: oldest ? Date.now() - oldest.runAfter.getTime() : 0,
      };
      if (!checks.queue.ok) healthy = false;
    } catch {
      checks.queue = { ok: false };
      healthy = false;
    }
  }

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, uptimeSec: Math.round(process.uptime()) },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
