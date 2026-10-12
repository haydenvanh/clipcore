import { describe, it, expect } from "vitest";
import { PLANS, PAID_PLAN_IDS, INTERVALS, lookupKey, parseLookupKey, monthlyPrice, formatUsd, COMPETITORS } from "../src/lib/plans.js";
import { billingStateFromSubscription, syncSubscription } from "../src/lib/billing-sync.js";
import { getUsage, monthWindow, formatDuration } from "../src/lib/usage.js";

const subscription = (overrides = {}) => ({
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  cancel_at_period_end: false,
  metadata: { userId: "u1" },
  items: { data: [{ price: { lookup_key: "clipcore_pro_year" }, current_period_end: 1_800_000_000 }] },
  ...overrides,
});

describe("plans", () => {
  it("round-trips every paid plan through its Stripe lookup key", () => {
    for (const plan of PAID_PLAN_IDS) {
      for (const interval of INTERVALS) {
        expect(parseLookupKey(lookupKey(plan, interval))).toEqual({ planId: plan, interval });
      }
    }
  });

  it("ignores keys that aren't ours, and the free plan", () => {
    expect(parseLookupKey("some_other_price")).toBeNull();
    expect(parseLookupKey("clipcore_free_month")).toBeNull();
    expect(parseLookupKey(undefined)).toBeNull();
  });

  it("makes yearly cheaper per month than monthly on every paid plan", () => {
    for (const id of PAID_PLAN_IDS) expect(monthlyPrice(PLANS[id], "year")).toBeLessThan(PLANS[id].price.month);
  });

  it("undercuts the competitor price it's compared against", () => {
    for (const [id, rival] of Object.entries(COMPETITORS)) {
      expect(PLANS[id].price.month).toBeLessThan(rival.month);
    }
  });

  it("formats prices", () => {
    expect(formatUsd(12)).toBe("$12");
    expect(formatUsd(14.5)).toBe("$14.50");
  });
});

describe("billingStateFromSubscription", () => {
  it("maps an active subscription to its plan, interval, and period end", () => {
    expect(billingStateFromSubscription(subscription())).toMatchObject({
      plan: "PRO",
      billingInterval: "year",
      stripeSubscriptionId: "sub_1",
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
      cancelAtPeriodEnd: false,
    });
  });

  it("keeps the plan while a payment is being retried", () => {
    expect(billingStateFromSubscription(subscription({ status: "past_due" })).plan).toBe("PRO");
  });

  it("drops to Free when the subscription ends or never activated", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(billingStateFromSubscription(subscription({ status })).plan).toBe("FREE");
    }
    expect(billingStateFromSubscription(subscription({ status: "canceled" })).stripeSubscriptionId).toBeNull();
  });

  it("drops to Free for a price that isn't one of ours", () => {
    const foreign = subscription({ items: { data: [{ price: { lookup_key: "something_else" } }] } });
    expect(billingStateFromSubscription(foreign).plan).toBe("FREE");
  });
});

/** Just enough of Prisma's user model for syncSubscription. */
function fakePrisma(users) {
  return {
    users,
    user: {
      findUnique: async ({ where }) =>
        users.find((u) => (where.id ? u.id === where.id : u.stripeCustomerId === where.stripeCustomerId)) ?? null,
      update: async ({ where, data }) => Object.assign(users.find((u) => u.id === where.id), data),
    },
  };
}

describe("syncSubscription", () => {
  it("finds the user by metadata and records the plan and customer", async () => {
    const prisma = fakePrisma([{ id: "u1", plan: "FREE", stripeSubscriptionId: null }]);
    expect(await syncSubscription(prisma, subscription())).toBe("u1");
    expect(prisma.users[0]).toMatchObject({ plan: "PRO", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" });
  });

  it("falls back to the Stripe customer id", async () => {
    const prisma = fakePrisma([{ id: "u2", stripeCustomerId: "cus_1", stripeSubscriptionId: null }]);
    await syncSubscription(prisma, subscription({ metadata: {} }));
    expect(prisma.users[0].plan).toBe("PRO");
  });

  it("ignores an old subscription ending after a new one started", async () => {
    const prisma = fakePrisma([{ id: "u1", plan: "UNLIMITED", stripeSubscriptionId: "sub_new" }]);
    await syncSubscription(prisma, subscription({ id: "sub_old", status: "canceled" }));
    expect(prisma.users[0].plan).toBe("UNLIMITED");
  });

  it("returns null when no user matches", async () => {
    expect(await syncSubscription(fakePrisma([]), subscription())).toBeNull();
  });
});

describe("usage", () => {
  const prismaWith = (seconds) => ({ usage: { aggregate: async () => ({ _sum: { seconds } }) } });

  it("counts minutes against the plan's monthly allowance", async () => {
    const usage = await getUsage(prismaWith(1500), { id: "u1", plan: "FREE" });
    expect(usage).toMatchObject({ plan: "FREE", usedSeconds: 1500, limitSeconds: 3600, remainingSeconds: 2100 });
  });

  it("never reports negative minutes left", async () => {
    expect((await getUsage(prismaWith(99_999), { id: "u1", plan: "STARTER" })).remainingSeconds).toBe(0);
  });

  it("has no limit on Unlimited", async () => {
    const usage = await getUsage(prismaWith(500_000), { id: "u1", plan: "UNLIMITED" });
    expect(usage.limitSeconds).toBeNull();
    expect(usage.remainingSeconds).toBeNull();
  });

  it("treats an unknown plan as Free", async () => {
    expect((await getUsage(prismaWith(null), { id: "u1", plan: "MYSTERY" })).limitSeconds).toBe(3600);
  });

  it("resets on the 1st of the month, UTC", () => {
    const { start, end } = monthWindow(new Date("2026-12-31T23:30:00Z"));
    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("formats durations", () => {
    expect(formatDuration(10035)).toBe("2h 47m");
    expect(formatDuration(2400)).toBe("40m");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(45)).toBe("45s");
  });
});
