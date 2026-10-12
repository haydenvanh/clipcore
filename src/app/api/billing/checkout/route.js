import { NextResponse } from "next/server";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getStripe, appUrl } from "@/lib/stripe";
import { INTERVALS, PAID_PLAN_IDS, lookupKey } from "@/lib/plans";

export const dynamic = "force-dynamic";

/** Start a Stripe Checkout for a paid plan; returns the URL to send the browser to. */
export const POST = handler("billing.checkout", async (req) => {
  const { id } = await requireUser();
  const { plan, interval } = await readJson(req);

  if (!PAID_PLAN_IDS.includes(plan) || !INTERVALS.includes(interval)) {
    throw new ApiError(400, "Choose a plan and billing period.");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, plan: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });

  // Changing plan while subscribed happens in the billing portal, so nobody
  // ends up paying for two subscriptions at once.
  if (user.stripeSubscriptionId && user.plan !== "FREE") {
    throw new ApiError(409, "You already have a plan. Change it from Billing → Manage subscription.");
  }

  const stripe = getStripe();
  const { data: prices } = await stripe.prices.list({ lookup_keys: [lookupKey(plan, interval)], active: true, limit: 1 });
  if (!prices[0]) throw new ApiError(503, "This plan isn't available yet. Run npm run stripe:setup.");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: prices[0].id, quantity: 1 }],
    ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
    client_reference_id: user.id,
    subscription_data: { metadata: { userId: user.id } },
    allow_promotion_codes: true,
    success_url: `${appUrl()}/billing?checkout=success`,
    cancel_url: `${appUrl()}/pricing`,
  });

  return NextResponse.json({ url: session.url });
});
