import { parseLookupKey } from "./plans.js";

/**
 * Turn Stripe state into our User billing fields.
 *
 * Every webhook re-derives the whole state from the subscription object
 * rather than applying deltas, so events arriving twice or out of order still
 * converge on what Stripe says now.
 */

/** Statuses that keep a paid plan. past_due is a grace period while Stripe retries the card. */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

/** The billing fields a subscription implies. */
export function billingStateFromSubscription(subscription) {
  const item = subscription?.items?.data?.[0];
  const parsed = parseLookupKey(item?.price?.lookup_key);
  const paid = PAID_STATUSES.has(subscription?.status) && parsed;
  // Since Stripe API 2025-03-31 the period lives on the subscription item.
  const periodEnd = item?.current_period_end ?? subscription?.current_period_end ?? null;

  return {
    plan: paid ? parsed.planId : "FREE",
    billingInterval: paid ? parsed.interval : null,
    stripeSubscriptionId: subscription?.status === "canceled" ? null : subscription?.id ?? null,
    subscriptionStatus: subscription?.status ?? null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
  };
}

/**
 * Apply a subscription to the user it belongs to.
 *
 * The user is found by the id put in subscription metadata at checkout, then
 * by Stripe customer id. Returns the updated user id, or null if no user
 * matches (for example, a subscription created by hand in the dashboard).
 */
export async function syncSubscription(prisma, subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const userId = subscription.metadata?.userId;

  const select = { id: true, stripeSubscriptionId: true };
  const user =
    (userId && (await prisma.user.findUnique({ where: { id: userId }, select }))) ||
    (customerId && (await prisma.user.findUnique({ where: { stripeCustomerId: customerId }, select })));
  if (!user) return null;

  // An old subscription ending must not downgrade someone who has since
  // started a new one.
  const state = billingStateFromSubscription(subscription);
  if (user.stripeSubscriptionId && user.stripeSubscriptionId !== subscription.id && state.plan === "FREE") {
    return user.id;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customerId ?? undefined, ...state },
  });
  return user.id;
}
