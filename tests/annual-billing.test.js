import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  priceFor, annualSaving, annualMonthlyEquivalent, stripePriceId, planFromPriceId, PLANS,
} from "@/lib/plans";

describe("annual pricing", () => {
  it("charges roughly ten months for twelve", () => {
    for (const id of ["BASIC", "PRO", "ULTRA"]) {
      const saving = annualSaving(id);
      expect(saving.monthsFree).toBeGreaterThanOrEqual(1.8);
      expect(saving.monthsFree).toBeLessThanOrEqual(2.6);
    }
  });

  it("saves between 15% and 20% against paying monthly", () => {
    for (const id of ["BASIC", "PRO", "ULTRA"]) {
      const { percent } = annualSaving(id);
      expect(percent).toBeGreaterThanOrEqual(15);
      expect(percent).toBeLessThanOrEqual(20);
    }
  });

  it("reports a monthly equivalent below the monthly price", () => {
    for (const id of ["BASIC", "PRO", "ULTRA"]) {
      expect(annualMonthlyEquivalent(id)).toBeLessThan(PLANS[id].priceCents);
    }
  });

  it("returns the annual total, not the monthly equivalent, as the headline", () => {
    // Advertising "$8/mo" when the charge is $99 once is the pattern we reject.
    const annual = priceFor("BASIC", "YEAR");
    expect(annual.priceCents).toBe(9900);
    expect(annual.per).toBe("year");
  });

  it("falls back to monthly for an unknown interval", () => {
    expect(priceFor("PRO", "WEEK").per).toBe("month");
    expect(priceFor("PRO").priceCents).toBe(1499);
  });

  it("returns null for an unknown plan", () => {
    expect(priceFor("ENTERPRISE", "YEAR")).toBeNull();
    expect(annualSaving("ENTERPRISE")).toBeNull();
  });
});

describe("stripe price resolution across intervals", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.STRIPE_PRICE_BASIC = "price_basic_m";
    process.env.STRIPE_PRICE_PRO = "price_pro_m";
    process.env.STRIPE_PRICE_ULTRA = "price_ultra_m";
    process.env.STRIPE_PRICE_BASIC_ANNUAL = "price_basic_y";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_pro_y";
    process.env.STRIPE_PRICE_ULTRA_ANNUAL = "price_ultra_y";
  });
  afterEach(() => { process.env = { ...saved }; });

  it("picks the right price id per interval", () => {
    expect(stripePriceId("PRO", "MONTH")).toBe("price_pro_m");
    expect(stripePriceId("PRO", "YEAR")).toBe("price_pro_y");
    expect(stripePriceId("PRO")).toBe("price_pro_m");
  });

  it("resolves an annual price id back to its plan and interval", () => {
    expect(planFromPriceId("price_ultra_y")).toMatchObject({ id: "ULTRA", interval: "YEAR" });
    expect(planFromPriceId("price_ultra_m")).toMatchObject({ id: "ULTRA", interval: "MONTH" });
  });

  it("still grants the monthly allowance on an annual plan", () => {
    // The annual subscriber gets 300/month, not 3600 up front.
    expect(planFromPriceId("price_pro_y").credits).toBe(PLANS.PRO.credits);
  });

  it("returns null for a price id we do not recognise", () => {
    expect(planFromPriceId("price_someone_elses")).toBeNull();
  });
});
