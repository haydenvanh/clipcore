import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { syncSubscription } from "@/lib/billing-sync";

export const dynamic = "force-dynamic";

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/**
 * Stripe → our database. The only writer of a user's plan.
 *
 * The signature is verified against the raw body, so nobody can POST a fake
 * "you're on Unlimited" event. Any failure returns 500 so Stripe retries.
 */
export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret not configured", { status: 503 });

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature"), secret);
  } catch (error) {
    return new Response(`Invalid signature: ${error.message}`, { status: 400 });
  }

  try {
    const stripe = getStripe();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.mode === "subscription" && session.client_reference_id && session.customer) {
        // Link the customer first, so the subscription sync below can find them
        // even if its own event arrives before this one.
        await prisma.user.update({
          where: { id: session.client_reference_id },
          data: { stripeCustomerId: session.customer },
        });
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await syncSubscription(prisma, subscription);
      }
    } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
      // Re-fetch rather than trust the event payload, which may be stale when
      // events arrive out of order.
      const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
      await syncSubscription(prisma, subscription);
    }
  } catch (error) {
    console.error("[webhook.stripe]", event.type, error);
    return new Response("Webhook handling failed", { status: 500 });
  }

  return new Response("ok");
}
