import { NextResponse } from "next/server";
import { ApiError, handler, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getStripe, appUrl } from "@/lib/stripe";
import { PAID_PLAN_IDS, INTERVALS, lookupKey } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * The portal configuration: switch between our plans, cancel at period end,
 * update the card, see invoices. Created once and found again by metadata,
 * so no dashboard setup is needed.
 */
async function portalConfiguration(stripe) {
  const { data: existing } = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const ours = existing.find((c) => c.metadata?.app === "clipcore");
  if (ours) return ours.id;

  const keys = PAID_PLAN_IDS.flatMap((plan) => INTERVALS.map((interval) => lookupKey(plan, interval)));
  const { data: prices } = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 100 });
  const byProduct = new Map();
  for (const price of prices) {
    const product = typeof price.product === "string" ? price.product : price.product.id;
    byProduct.set(product, [...(byProduct.get(product) ?? []), price.id]);
  }

  const created = await stripe.billingPortal.configurations.create({
    metadata: { app: "clipcore" },
    business_profile: { headline: "Manage your ClipCore plan" },
    features: {
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        products: [...byProduct].map(([product, ids]) => ({ product, prices: ids })),
        proration_behavior: "create_prorations",
      },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  });
  return created.id;
}

/** Open the Stripe billing portal; returns its URL. */
export const POST = handler("billing.portal", async () => {
  const { id } = await requireUser();
  const user = await prisma.user.findUnique({ where: { id }, select: { stripeCustomerId: true } });
  if (!user.stripeCustomerId) throw new ApiError(400, "You don't have a subscription yet.");

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    configuration: await portalConfiguration(stripe),
    return_url: `${appUrl()}/billing`,
  });
  return NextResponse.json({ url: session.url });
});
