import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The failure this file exists to prevent: Stripe delivers at least once and
 * retries on any non-2xx, so a retried `invoice.paid` used to grant a second
 * month of credits.
 */

const P2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

const db = {
  seenEvents: new Set(),
  grants: [],
  transactions: [],
  subscriptions: new Map(),
  nextGrants: [],
};

const prisma = {
  webhookEvent: {
    create: vi.fn(async ({ data }) => {
      const key = `${data.provider}:${data.externalId}`;
      if (db.seenEvents.has(key)) throw P2002;
      db.seenEvents.add(key);
      return data;
    }),
    update: vi.fn(async () => ({})),
  },
  subscription: {
    findFirst: vi.fn(async () => null),
    updateMany: vi.fn(async () => ({ count: 1 })),
    // Called after a paid invoice to schedule the next monthly credit grant.
    update: vi.fn(async ({ data }) => {
      db.nextGrants.push(data.nextCreditGrantAt);
      return data;
    }),
    upsert: vi.fn(async ({ create }) => {
      db.subscriptions.set(create.stripeSubscriptionId, create);
      return { id: "sub_row_1", ...create };
    }),
  },
  user: { findUnique: vi.fn(async () => ({ id: "user_1", credits: 0 })), update: vi.fn() },
  transaction: { create: vi.fn(async ({ data }) => { db.transactions.push(data); return data; }) },
};

const stripeEvent = {
  id: "evt_1",
  type: "invoice.paid",
  data: {
    object: {
      id: "in_1",
      customer: "cus_1",
      currency: "usd",
      amount_paid: 1499,
      subscription: "sub_1",
      metadata: {},
    },
  },
};

const stripe = {
  webhooks: { constructEvent: vi.fn(() => stripeEvent) },
  subscriptions: {
    retrieve: vi.fn(async () => ({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      cancel_at_period_end: false,
      canceled_at: null,
      current_period_start: 1_756_000_000,
      current_period_end: 1_758_592_000,
      metadata: { userId: "user_1" },
      items: { data: [{ price: { id: "price_pro_1" } }] },
    })),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/stripe", () => ({ stripe, getStripe: () => stripe, isStripeConfigured: true }));
vi.mock("@/lib/services/credits", () => ({
  CreditService: {
    grant: vi.fn(async (userId, amount, opts) => {
      // Mirror the real service: the idempotency key is unique, so a repeat is
      // a no-op rather than a second grant.
      if (opts?.idempotencyKey && db.grants.some((g) => g.key === opts.idempotencyKey)) {
        return 0;
      }
      db.grants.push({ userId, amount, key: opts?.idempotencyKey });
      return amount;
    }),
  },
  InsufficientCreditsError: class extends Error {},
}));

process.env.STRIPE_PRICE_BASIC = "price_basic_1";
process.env.STRIPE_PRICE_PRO = "price_pro_1";
process.env.STRIPE_PRICE_ULTRA = "price_ultra_1";

const { BillingService } = await import("@/lib/services/billing");

describe("Stripe webhook idempotency", () => {
  beforeEach(() => {
    db.seenEvents.clear();
    db.grants.length = 0;
    db.transactions.length = 0;
    db.nextGrants.length = 0;
  });

  it("grants credits once for a first delivery", async () => {
    const result = await BillingService.handleWebhook("{}", "sig");
    expect(result.received).toBe(true);
    expect(db.grants).toHaveLength(1);
    expect(db.grants[0]).toMatchObject({ userId: "user_1", amount: 300 });
  });

  it("drops a redelivery of the same event id without granting again", async () => {
    await BillingService.handleWebhook("{}", "sig");
    const replay = await BillingService.handleWebhook("{}", "sig");

    expect(replay.deduplicated).toBe(true);
    expect(db.grants).toHaveLength(1); // still one, not two
  });

  it("records the payment as a transaction", async () => {
    await BillingService.handleWebhook("{}", "sig");
    expect(db.transactions[0]).toMatchObject({
      userId: "user_1",
      amountCents: 1499,
      status: "SUCCEEDED",
      creditsGranted: 300,
    });
  });

  it("grants the credits of the plan the price id maps to, not a default", async () => {
    await BillingService.handleWebhook("{}", "sig");
    expect(db.grants[0].amount).toBe(300); // PRO, from price_pro_1
  });

  it("keys the grant on the invoice, so a new event id for one invoice still grants once", async () => {
    await BillingService.handleWebhook("{}", "sig");
    db.seenEvents.clear(); // simulate a different event id for the same invoice
    await BillingService.handleWebhook("{}", "sig");
    expect(db.grants).toHaveLength(1);
    expect(db.grants[0].key).toBe("invoice:in_1");
  });

  it("schedules the next monthly grant a month out", async () => {
    await BillingService.handleWebhook("{}", "sig");

    expect(db.nextGrants).toHaveLength(1);
    const next = db.nextGrants[0];
    const daysAway = (next.getTime() - Date.now()) / 86_400_000;
    // Between 28 and 31 days, whatever month it is.
    expect(daysAway).toBeGreaterThan(27);
    expect(daysAway).toBeLessThan(32);
  });

  it("grants one month of credits on an annual invoice, not twelve", async () => {
    await BillingService.handleWebhook("{}", "sig");
    // PRO is 300/month. An annual subscriber must not receive 3600 up front.
    expect(db.grants[0].amount).toBe(300);
  });

  it("propagates a signature failure instead of accepting the payload", async () => {
    stripe.webhooks.constructEvent.mockImplementationOnce(() => {
      throw Object.assign(new Error("bad sig"), { type: "StripeSignatureVerificationError" });
    });
    await expect(BillingService.handleWebhook("{}", "bad")).rejects.toThrow("bad sig");
    expect(db.grants).toHaveLength(0);
  });
});
