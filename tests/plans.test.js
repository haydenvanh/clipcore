import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PLANS, PLAN_ORDER, FREE_TIER, getPlan, limitsForPlan,
  creditsForDuration, publicPlans, planFromPriceId, stripePriceId,
} from "@/lib/plans";

describe("plan catalogue", () => {
  it("offers exactly the three plans in the brief, at the stated prices", () => {
    expect(PLAN_ORDER).toEqual(["BASIC", "PRO", "ULTRA"]);
    expect(PLANS.BASIC.priceCents).toBe(999);
    expect(PLANS.BASIC.credits).toBe(150);
    expect(PLANS.PRO.priceCents).toBe(1499);
    expect(PLANS.PRO.credits).toBe(300);
    expect(PLANS.ULTRA.priceCents).toBe(2999);
    expect(PLANS.ULTRA.credits).toBe(800);
  });

  it("keeps $/min falling as the tier rises, so upgrading is visibly better", () => {
    const perMinute = publicPlans().map((p) => p.priceCents / p.credits);
    expect(perMinute[0]).toBeGreaterThan(perMinute[1]);
    expect(perMinute[1]).toBeGreaterThan(perMinute[2]);
  });

  it("resolves plans case-insensitively and rejects unknown ids", () => {
    expect(getPlan("basic")?.id).toBe("BASIC");
    expect(getPlan("PRO")?.id).toBe("PRO");
    // These are the ids the old pricing page sent, which the server did not know.
    expect(getPlan("standard")).toBeNull();
    expect(getPlan("business")).toBeNull();
    expect(getPlan(undefined)).toBeNull();
    expect(getPlan(null)).toBeNull();
  });

  it("falls back to free-tier limits when there is no subscription", () => {
    expect(limitsForPlan(null)).toEqual(FREE_TIER);
    expect(limitsForPlan("PRO").maxConcurrentJobs).toBe(2);
    expect(limitsForPlan("ULTRA").maxVideoMinutes).toBe(300);
  });
});

describe("creditsForDuration — 1 credit = 1 minute, rounded up", () => {
  it.each([
    [0, 1], [1, 1], [59, 1], [60, 1], [61, 2], [90, 2],
    [3600, 60], [3601, 61], [10800, 180],
  ])("%i seconds costs %i credits", (seconds, expected) => {
    expect(creditsForDuration(seconds)).toBe(expected);
  });

  it("never returns zero or NaN for junk input", () => {
    expect(creditsForDuration(-5)).toBe(1);
    expect(creditsForDuration(NaN)).toBe(1);
    expect(creditsForDuration(undefined)).toBe(1);
  });
});

describe("stripe price mapping", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.STRIPE_PRICE_BASIC = "price_basic_1";
    process.env.STRIPE_PRICE_PRO = "price_pro_1";
    process.env.STRIPE_PRICE_ULTRA = "price_ultra_1";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("maps ids both ways", () => {
    expect(stripePriceId("PRO")).toBe("price_pro_1");
    expect(planFromPriceId("price_pro_1")?.id).toBe("PRO");
    expect(planFromPriceId("price_ultra_1")?.credits).toBe(800);
  });

  it("returns null for an unrecognised price rather than guessing a plan", () => {
    expect(planFromPriceId("price_someone_elses")).toBeNull();
    expect(planFromPriceId(undefined)).toBeNull();
  });
});
