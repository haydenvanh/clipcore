import { NextResponse } from "next/server";
import { handler, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

/** The signed-in user's plan, subscription, and minutes used this month. */
export const GET = handler("billing", async () => {
  const { id } = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, plan: true, billingInterval: true, subscriptionStatus: true,
      currentPeriodEnd: true, cancelAtPeriodEnd: true, stripeCustomerId: true,
    },
  });
  const usage = await getUsage(prisma, user);

  return NextResponse.json({
    plan: user.plan,
    interval: user.billingInterval,
    status: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    canManage: Boolean(user.stripeCustomerId),
    usage,
  });
});
