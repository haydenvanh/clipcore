import { PLANS } from "./plans.js";

/**
 * How many minutes a user has used and has left this month.
 *
 * Plain JavaScript taking the Prisma client as an argument, so the web app
 * and the worker share one implementation.
 */

/** The current calendar month in UTC: minutes reset on the 1st. */
export function monthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{id: string, plan?: string}} user
 * @returns {Promise<{plan: string, usedSeconds: number, limitSeconds: number|null, remainingSeconds: number|null, resetsAt: Date}>}
 *   limitSeconds and remainingSeconds are null on an unlimited plan.
 */
export async function getUsage(prisma, user, now = new Date()) {
  const plan = PLANS[user.plan] ?? PLANS.FREE;
  const { start, end } = monthWindow(now);

  const { _sum } = await prisma.usage.aggregate({
    where: { userId: user.id, createdAt: { gte: start, lt: end } },
    _sum: { seconds: true },
  });
  const usedSeconds = _sum.seconds ?? 0;
  const limitSeconds = plan.minutes == null ? null : plan.minutes * 60;

  return {
    plan: plan.id,
    usedSeconds,
    limitSeconds,
    remainingSeconds: limitSeconds == null ? null : Math.max(0, limitSeconds - usedSeconds),
    resetsAt: end,
  };
}

/** "2h 47m", "40m", "45s" — for limit messages. */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
