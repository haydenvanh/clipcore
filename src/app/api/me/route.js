import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BillingService } from "@/lib/services/billing";
import { limitsForPlan } from "@/lib/plans";
import { handler, requireUser } from "@/lib/api";

/**
 * Live account state: balance, plan, and limits.
 *
 * The Navbar previously read credits from the session, which is only refreshed
 * on sign-in, so the balance stayed stale after every generation and purchase.
 */
export const GET = handler("ME", async () => {
  const sessionUser = await requireUser();

  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, name: true, email: true, image: true, credits: true, role: true, createdAt: true },
    }),
    BillingService.getActiveSubscription(sessionUser.id),
  ]);

  const limits = limitsForPlan(subscription?.plan);

  return NextResponse.json({
    user,
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
    limits,
  });
});
