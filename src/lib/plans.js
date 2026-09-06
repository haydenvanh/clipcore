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
export function stripePriceId(planId) {
  const ids = {
    BASIC: process.env.STRIPE_PRICE_BASIC,
    PRO: process.env.STRIPE_PRICE_PRO,
    ULTRA: process.env.STRIPE_PRICE_ULTRA,
  };
  return ids[planId];
}

/** Resolve a Stripe price id back to the plan it belongs to. */
export function planFromPriceId(priceId) {
  if (!priceId) return null;
  for (const id of PLAN_ORDER) {
    if (stripePriceId(id) === priceId) return PLANS[id];
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
