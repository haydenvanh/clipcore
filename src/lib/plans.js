/**
 * The single source of truth for pricing.
 *
 * Both the pricing page and the checkout endpoint read from here. The previous
 * code had two divergent lists — the UI offered basic/standard/pro/business
 * while the server knew only a "default" plan — so every checkout returned
 * "Invalid plan selected".
 *
 * Rule: 1 credit = 1 minute of source video processed. See
 * docs/PRICING_STRATEGY.md for why minutes and why these numbers.
 */

/** @typedef {"BASIC" | "PRO" | "ULTRA"} PlanId */

export const PLANS = {
  BASIC: {
    id: "BASIC",
    name: "Basic",
    priceCents: 999,
    priceLabel: "$9.99",
    credits: 150,
    /** Longest single source video, in minutes. */
    maxVideoMinutes: 60,
    /** Simultaneous jobs. Also a genuine, non-arbitrary reason to upgrade. */
    maxConcurrentJobs: 1,
    tagline: "For creators getting started with clips.",
    features: [
      "150 minutes of video per month",
      "Up to 60-minute videos",
      "Karaoke captions",
      "9:16, 1:1 and 16:9 exports",
      "Viral score on every clip",
      "No watermark",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceCents: 1499,
    priceLabel: "$14.99",
    credits: 300,
    maxVideoMinutes: 180,
    maxConcurrentJobs: 2,
    popular: true,
    tagline: "For podcasters shipping every week.",
    features: [
      "300 minutes of video per month",
      "Up to 3-hour videos",
      "2 videos processing at once",
      "Everything in Basic",
      "Priority queue",
    ],
  },
  ULTRA: {
    id: "ULTRA",
    name: "Ultra",
    priceCents: 2999,
    priceLabel: "$29.99",
    credits: 800,
    maxVideoMinutes: 300,
    maxConcurrentJobs: 4,
    tagline: "For studios and agencies at volume.",
    features: [
      "800 minutes of video per month",
      "Up to 5-hour videos",
      "4 videos processing at once",
      "Everything in Pro",
      "Priority support",
    ],
  },
};

export const PLAN_ORDER = ["BASIC", "PRO", "ULTRA"];

/**
 * Annual pricing: pay for ten months, get twelve.
 *
 * Two reasons it is worth offering. Cash arrives up front, which matters more
 * than margin to a bootstrapped business; and Stripe's $0.30 fixed fee is paid
 * once instead of twelve times, which on a $9.99 plan is most of the discount
 * paying for itself.
 *
 * Credits are still granted monthly (see BillingService) — annual changes when
 * we are paid, not how much anyone can spend in a month.
 */
export const ANNUAL_PRICES = {
  BASIC: { priceCents: 9900, priceLabel: "$99" },
  PRO: { priceCents: 14900, priceLabel: "$149" },
  ULTRA: { priceCents: 29900, priceLabel: "$299" },
};

export const INTERVALS = { MONTH: "MONTH", YEAR: "YEAR" };

/** Monthly-equivalent cost of the annual plan, for the pricing table. */
export function annualMonthlyEquivalent(planId) {
  const annual = ANNUAL_PRICES[planId];
  if (!annual) return null;
  return Math.round(annual.priceCents / 12);
}

/** How much a year of annual saves against twelve monthly payments. */
export function annualSaving(planId) {
  const plan = PLANS[planId];
  const annual = ANNUAL_PRICES[planId];
  if (!plan || !annual) return null;

  const twelveMonthly = plan.priceCents * 12;
  const saved = twelveMonthly - annual.priceCents;

  return {
    savedCents: saved,
    savedLabel: `$${Math.round(saved / 100)}`,
    percent: Math.round((saved / twelveMonthly) * 100),
    monthsFree: Math.round((saved / plan.priceCents) * 10) / 10,
  };
}

/** Price and label for a plan at a given interval. */
export function priceFor(planId, interval = INTERVALS.MONTH) {
  const plan = PLANS[planId];
  if (!plan) return null;

  if (interval === INTERVALS.YEAR) {
    const annual = ANNUAL_PRICES[planId];
    if (!annual) return null;
    return {
      priceCents: annual.priceCents,
      priceLabel: annual.priceLabel,
      per: "year",
      monthlyEquivalentCents: annualMonthlyEquivalent(planId),
      saving: annualSaving(planId),
    };
  }

  return {
    priceCents: plan.priceCents,
    priceLabel: plan.priceLabel,
    per: "month",
    monthlyEquivalentCents: plan.priceCents,
    saving: null,
  };
}

/** Limits for a signed-in user with no active subscription. */
export const FREE_TIER = {
  id: "FREE",
  name: "Free",
  credits: 10,
  maxVideoMinutes: 30,
  maxConcurrentJobs: 1,
};

/**
 * Stripe price ids, per plan. Set these in the environment — hardcoding them
 * makes test and live mode impossible to run side by side.
 */
export function stripePriceId(planId, interval = "MONTH") {
  const monthly = {
    BASIC: process.env.STRIPE_PRICE_BASIC,
    PRO: process.env.STRIPE_PRICE_PRO,
    ULTRA: process.env.STRIPE_PRICE_ULTRA,
  };
  const annual = {
    BASIC: process.env.STRIPE_PRICE_BASIC_ANNUAL,
    PRO: process.env.STRIPE_PRICE_PRO_ANNUAL,
    ULTRA: process.env.STRIPE_PRICE_ULTRA_ANNUAL,
  };
  return (interval === "YEAR" ? annual : monthly)[planId];
}

/**
 * Resolve a Stripe price id back to its plan and interval.
 * Checks both intervals, so an annual subscription is attributed correctly.
 */
export function planFromPriceId(priceId) {
  if (!priceId) return null;
  for (const id of PLAN_ORDER) {
    if (stripePriceId(id, "MONTH") === priceId) return { ...PLANS[id], interval: "MONTH" };
    if (stripePriceId(id, "YEAR") === priceId) return { ...PLANS[id], interval: "YEAR" };
  }
  return null;
}

export function getPlan(planId) {
  if (typeof planId !== "string") return null;
  return PLANS[planId.toUpperCase()] ?? null;
}

/** Limits that apply to a user, whether subscribed or not. */
export function limitsForPlan(planId) {
  const plan = getPlan(planId);
  if (!plan) return FREE_TIER;
  return {
    id: plan.id,
    name: plan.name,
    credits: plan.credits,
    maxVideoMinutes: plan.maxVideoMinutes,
    maxConcurrentJobs: plan.maxConcurrentJobs,
  };
}

/**
 * Credits for a video, at 1 credit per minute, rounded up.
 * A 90-second video costs 2 credits, not 1.5.
 */
export function creditsForDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 1;
  return Math.max(1, Math.ceil(durationSeconds / 60));
}

/** Plan list for the pricing page, in display order. */
export function publicPlans() {
  return PLAN_ORDER.map((id) => PLANS[id]);
}
