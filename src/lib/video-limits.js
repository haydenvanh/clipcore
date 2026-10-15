import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { getUsage, formatDuration } from "@/lib/usage";
import { PLANS } from "@/lib/plans";

export const IN_FLIGHT = ["PENDING", "EXTRACTING", "TRANSCRIBING", "ANALYZING", "RENDERING"];

/**
 * May this user start another video? Throws a 402 when the month's minutes
 * are used up and a 429 at the plan's limit of videos processing at once.
 * The exact check against a video's length happens in the worker once the
 * length is known.
 *
 * @returns {Promise<{plan: object}>}
 */
export async function assertCanStartVideo(userId) {
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, plan: true } });
  const plan = PLANS[account.plan] ?? PLANS.FREE;

  const usage = await getUsage(prisma, account);
  if (usage.remainingSeconds === 0) {
    const resets = usage.resetsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
    throw new ApiError(402, `You've used all ${formatDuration(usage.limitSeconds)} of video this month. Upgrade your plan, or your minutes reset on ${resets}.`);
  }

  const inFlight = await prisma.video.count({ where: { userId, status: { in: IN_FLIGHT } } });
  if (inFlight >= plan.maxInFlight) {
    const upgrade = plan.id === "FREE" || plan.id === "STARTER" ? " Upgrade to process more at once." : "";
    throw new ApiError(
      429,
      `${plan.name} processes ${plan.maxInFlight === 1 ? "one video" : `${plan.maxInFlight} videos`} at a time — start another when this finishes.${upgrade}`
    );
  }

  return { plan };
}
