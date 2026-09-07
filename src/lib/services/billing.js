import { stripe } from "../stripe";
import config from "../config";
import { prisma } from "@/lib/prisma";
import { CreditService } from "./credits";
import { getPlan, planFromPriceId, stripePriceId } from "@/lib/plans";

/**
 * Subscription billing.
 *
 * Replaces the previous one-time "credit pack" implementation, which could not
 * express recurring revenue and, as shipped, threw "Invalid plan selected" on
 * every request because the UI's plan ids did not exist in config.
 *
 * Every inbound event is deduplicated through WebhookEvent before it is acted
 * on: Stripe delivers at least once and retries on any non-2xx, so without this
 * a single retry granted a month of credits twice.
 */

const STATUS_MAP = {
  active: "ACTIVE",
  trialing: "TRIALING",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELED",
  unpaid: "UNPAID",
};

/** Stripe sends seconds; Prisma wants a Date. */
function toDate(seconds) {
  return seconds ? new Date(seconds * 1000) : null;
}

/**
 * Read the subscription id off an invoice.
 *
 * Stripe moved this field: older API versions put it at `invoice.subscription`,
 * 2025+ versions nest it under `parent.subscription_details`. Checking both
 * means an API version bump does not silently stop granting credits.
 */
function subscriptionIdFromInvoice(invoice) {
  return (
    invoice.subscription ||
    invoice.parent?.subscription_details?.subscription ||
    invoice.lines?.data?.[0]?.parent?.subscription_item_details?.subscription ||
    null
  );
}

/** Add whole months, clamping to the last day of a shorter month. */
function addMonths(date, count) {
  const result = new Date(date);
  const targetDay = result.getDate();
  result.setMonth(result.getMonth() + count);
  // 31 Jan + 1 month must not roll into 3 March.
  if (result.getDate() < targetDay) result.setDate(0);
  return result;
}

function periodFromSubscription(subscription) {
  const item = subscription.items?.data?.[0];
  const start =
    toDate(subscription.current_period_start) ?? toDate(item?.current_period_start) ?? new Date();
  const end =
    toDate(subscription.current_period_end) ??
    toDate(item?.current_period_end) ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

export const BillingService = {
  /** Find or create this user's Stripe customer, and remember it. */
  async ensureCustomer(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, stripeCustomerId: true },
    });
    if (!user) throw new Error("User not found");
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  },

  /**
   * Start a subscription checkout.
   *
   * If the user already subscribes, we send them to the Customer Portal
   * instead — Stripe handles proration, upgrades, and downgrades far better
   * than a second checkout would, and it avoids two live subscriptions.
   */
  async createCheckoutSession(userId, planId, interval = "MONTH") {
    const plan = getPlan(planId);
    if (!plan) throw new Error(`Unknown plan: ${planId}`);

    const billingInterval = interval === "YEAR" ? "YEAR" : "MONTH";
    const priceId = stripePriceId(plan.id, billingInterval);
    if (!priceId) {
      throw new Error(
        `STRIPE_PRICE_${plan.id}${billingInterval === "YEAR" ? "_ANNUAL" : ""} is not configured`
      );
    }

    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      return { url: await this.createPortalSession(userId), changedExisting: true };
    }

    const customerId = await this.ensureCustomer(userId);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${config.auth.url}/dashboard?checkout=success`,
      cancel_url: `${config.auth.url}/pricing?checkout=canceled`,
      // Carried onto the subscription so webhooks can attribute it without a
      // customer lookup.
      subscription_data: { metadata: { userId, planId: plan.id, interval: billingInterval } },
      metadata: { userId, planId: plan.id, interval: billingInterval },
    });

    return { url: session.url, changedExisting: false };
  },

  /** Stripe-hosted portal: upgrades, downgrades, cancellation, invoices, cards. */
  async createPortalSession(userId) {
    const customerId = await this.ensureCustomer(userId);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${config.auth.url}/dashboard/billing`,
    });
    return session.url;
  },

  /**
   * Grant the monthly credit allowance to annual subscribers who are due.
   *
   * Monthly plans get their credits from invoice.paid; annual plans only see
   * one invoice a year, so this is what keeps their allowance arriving. Run it
   * from a scheduled job — it is idempotent per subscription per month, so a
   * double run grants nothing extra.
   */
  async grantDueCredits({ now = new Date(), limit = 200 } = {}) {
    const due = await prisma.subscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIALING"] },
        interval: "YEAR",
        nextCreditGrantAt: { lte: now },
        currentPeriodEnd: { gte: now },
      },
      take: limit,
    });

    const granted = [];

    for (const subscription of due) {
      const plan = getPlan(subscription.plan);
      const credits = subscription.creditsPerPeriod || plan?.credits || 0;
      // The month key makes the grant idempotent: a retry inside the same
      // month is a no-op rather than a second allowance.
      const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

      try {
        await CreditService.grant(subscription.userId, credits, {
          type: "GRANT",
          refType: "subscription",
          refId: subscription.id,
          idempotencyKey: `annual:${subscription.id}:${monthKey}`,
          description: `${plan?.name ?? subscription.plan} monthly allowance`,
        });

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { nextCreditGrantAt: addMonths(now, 1) },
        });

        granted.push({ subscriptionId: subscription.id, credits });
      } catch (error) {
        console.error("[BILLING] Monthly grant failed", subscription.id, error.message);
      }
    }

    return { checked: due.length, granted };
  },

  async getActiveSubscription(userId) {
    return prisma.subscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Verify, deduplicate, and dispatch an inbound Stripe event.
   *
   * @param {string|Buffer} rawBody the exact bytes Stripe sent
   */
  async handleWebhook(rawBody, signature) {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.webhookSecret
    );

    // Claim the event id. The unique constraint on (provider, externalId) means
    // a concurrent redelivery loses the race and is dropped.
    try {
      await prisma.webhookEvent.create({
        data: { provider: "stripe", externalId: event.id, type: event.type },
      });
    } catch (error) {
      if (error.code === "P2002") {
        return { received: true, deduplicated: true };
      }
      throw error;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await this.onCheckoutCompleted(event);
          break;
        case "invoice.paid":
          await this.onInvoicePaid(event);
          break;
        case "invoice.payment_failed":
          await this.onInvoicePaymentFailed(event);
          break;
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await this.onSubscriptionChanged(event);
          break;
        case "customer.subscription.deleted":
          await this.onSubscriptionDeleted(event);
          break;
        default:
          break;
      }

      await prisma.webhookEvent.update({
        where: { provider_externalId: { provider: "stripe", externalId: event.id } },
        data: { processedAt: new Date() },
      });

      return { received: true, type: event.type };
    } catch (error) {
      // Record the failure and rethrow so Stripe retries. The event row stays
      // unprocessed, and the ledger's idempotency keys make the retry safe.
      await prisma.webhookEvent.update({
        where: { provider_externalId: { provider: "stripe", externalId: event.id } },
        data: { error: String(error.message).slice(0, 2000) },
      });
      throw error;
    }
  },

  /** Resolve the app user behind a Stripe customer id. */
  async userIdForCustomer(customerId, fallbackUserId) {
    if (fallbackUserId) return fallbackUserId;
    if (!customerId) return null;
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    return user?.id ?? null;
  },

  async onCheckoutCompleted(event) {
    const session = event.data.object;
    if (session.mode !== "subscription" || !session.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await this.upsertSubscription(subscription, session.metadata?.userId);
  },

  /**
   * The renewal path. Credits are granted here rather than on
   * checkout.session.completed, because invoice.paid fires for the first
   * period *and* every renewal — one code path, no special-casing.
   */
  async onInvoicePaid(event) {
    const invoice = event.data.object;
    const subscriptionId = subscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const record = await this.upsertSubscription(subscription, invoice.metadata?.userId);
    if (!record) return;

    const plan = getPlan(record.plan);
    const credits = record.creditsPerPeriod || plan?.credits || 0;

    // One month's worth, even on an annual invoice. Handing over twelve months
    // of credits on day one lets a user spend the year's allowance in a
    // weekend at 0% margin; the rest arrive from the monthly grant cron.
    await CreditService.grant(record.userId, credits, {
      type: "GRANT",
      refType: "invoice",
      refId: invoice.id,
      // One grant per invoice, forever, however many times it is delivered.
      idempotencyKey: `invoice:${invoice.id}`,
      description: `${plan?.name ?? record.plan} plan — ${credits} credits`,
    });

    // Schedule the next monthly grant a month out, for both intervals.
    await prisma.subscription.update({
      where: { id: record.id },
      data: { nextCreditGrantAt: addMonths(new Date(), 1) },
    });

    await prisma.transaction.create({
      data: {
        userId: record.userId,
        stripeEventId: event.id,
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        amountCents: invoice.amount_paid ?? 0,
        currency: invoice.currency ?? "usd",
        status: "SUCCEEDED",
        creditsGranted: credits,
        description: `${plan?.name ?? record.plan} subscription`,
      },
    });
  },

  async onInvoicePaymentFailed(event) {
    const invoice = event.data.object;
    const subscriptionId = subscriptionIdFromInvoice(invoice);

    const userId = await this.userIdForCustomer(invoice.customer, invoice.metadata?.userId);
    if (!userId) return;

    if (subscriptionId) {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: "PAST_DUE" },
      });
    }

    await prisma.transaction.create({
      data: {
        userId,
        stripeEventId: event.id,
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        amountCents: invoice.amount_due ?? 0,
        currency: invoice.currency ?? "usd",
        status: "FAILED",
        description: "Payment failed",
      },
    });
  },

  async onSubscriptionChanged(event) {
    await this.upsertSubscription(event.data.object);
  },

  async onSubscriptionDeleted(event) {
    const subscription = event.data.object;
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: "CANCELED", canceledAt: new Date() },
    });
  },

  /**
   * Mirror a Stripe subscription into our database.
   *
   * Upgrades and downgrades arrive here as customer.subscription.updated with a
   * new price, so plan changes need no separate handling: the price id is
   * resolved back to a plan and the row is rewritten.
   */
  async upsertSubscription(subscription, fallbackUserId) {
    const userId = await this.userIdForCustomer(
      subscription.customer,
      subscription.metadata?.userId ?? fallbackUserId
    );
    if (!userId) {
      console.error("[BILLING] No user for subscription", subscription.id);
      return null;
    }

    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = planFromPriceId(priceId);
    if (!plan) {
      console.error("[BILLING] Unknown price id", priceId);
      return null;
    }

    // Trust the price id over metadata: metadata is set at checkout and goes
    // stale the moment someone switches plans in the Customer Portal.
    const interval =
      plan.interval ?? (subscription.items?.data?.[0]?.price?.recurring?.interval === "year" ? "YEAR" : "MONTH");

    const { start, end } = periodFromSubscription(subscription);
    const status = STATUS_MAP[subscription.status] ?? "INCOMPLETE";

    const data = {
      userId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      plan: plan.id,
      status,
      interval,
      creditsPerPeriod: plan.credits,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      canceledAt: toDate(subscription.canceled_at),
    };

    return prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      create: data,
      update: data,
    });
  },
};
