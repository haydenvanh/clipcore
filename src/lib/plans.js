/**
 * Plans and prices: the one source of truth for the pricing page, the Stripe
 * setup script, and usage limits.
 *
 * Plain JavaScript with no "@/" imports, because the worker imports it too.
 *
 * Minutes are minutes of source video processed per calendar month (UTC),
 * charged once per video when its download finishes. Retrying a failed video
 * is free.
 */

export const INTERVALS = ["month", "year"];

/** No single video longer than this, on any plan. */
export const MAX_VIDEO_SECONDS = 4 * 60 * 60;

export const PLANS = {
  FREE: {
    id: "FREE",
    name: "Free",
    tagline: "Try it on your own videos",
    minutes: 60,
    price: { month: 0, year: 0 },
    maxInFlight: 1, // videos processing at once
    priority: 0, // job queue priority; higher runs first
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    tagline: "For creators posting every week",
    minutes: 200,
    price: { month: 9, year: 72 },
    maxInFlight: 2,
    priority: 1,
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    tagline: "For creators posting every day",
    minutes: 600,
    price: { month: 19, year: 144 },
    maxInFlight: 3,
    priority: 2,
    featured: true,
  },
  UNLIMITED: {
    id: "UNLIMITED",
    name: "Unlimited",
    tagline: "For podcasts, streamers, and agencies",
    minutes: null, // no monthly cap; fair use applies
    price: { month: 25, year: 204 },
    maxInFlight: 3,
    priority: 2,
  },
};

export const PAID_PLAN_IDS = ["STARTER", "PRO", "UNLIMITED"];

/**
 * What each plan includes, OpusClip-style: each paid plan lists what it adds
 * to the one below. Only shipped features go here — anything planned goes in
 * COMING_SOON, which the pricing page labels as such.
 */
export const PLAN_FEATURES = {
  FREE: {
    heading: null,
    items: [
      "AI picks the strongest moments",
      "Word-by-word animated captions",
      "Vertical 9:16 clips in 1080p",
      "No watermark",
      "Caption files (SRT & VTT)",
      "1 video processing at a time",
    ],
  },
  STARTER: { heading: "Everything in Free, plus:", items: ["Priority processing", "2 videos processing at once"] },
  PRO: { heading: "Everything in Starter, plus:", items: ["Top-priority processing", "3 videos processing at once"] },
  UNLIMITED: { heading: "Everything in Pro, plus:", items: ["No monthly minute cap", "Fair use: 3 videos processing at once"] },
};

export const COMING_SOON = [
  "Auto-post to TikTok, YouTube Shorts, Instagram & Facebook Reels",
  "Choose your caption style",
  "Square and landscape exports",
];

/**
 * Competitor prices, read from their public pricing pages on the date below.
 * Shown as comparisons on the pricing page, so they must stay accurate:
 * re-check before changing them.
 */
export const COMPETITOR_PRICES_CHECKED = "October 12, 2026";
export const COMPETITORS = {
  STARTER: { name: "OpusClip Starter", month: 15, minutes: 150, source: "https://www.opus.pro/pricing" },
  PRO: { name: "OpusClip Pro", month: 29, yearPerMonth: 14.5, minutes: 300, source: "https://www.opus.pro/pricing" },
  UNLIMITED: { name: "OpusClip Pro", month: 29, yearPerMonth: 14.5, minutes: 300, source: "https://www.opus.pro/pricing" },
};

/** Stripe price lookup key for a plan and interval, e.g. "clipcore_pro_month". */
export function lookupKey(planId, interval) {
  return `clipcore_${planId.toLowerCase()}_${interval}`;
}

/** The plan and interval a lookup key stands for, or null if it isn't ours. */
export function parseLookupKey(key) {
  const match = /^clipcore_([a-z]+)_(month|year)$/.exec(String(key ?? ""));
  if (!match) return null;
  const planId = match[1].toUpperCase();
  return PAID_PLAN_IDS.includes(planId) ? { planId, interval: match[2] } : null;
}

/** Price per month for display: the yearly price is shown as its monthly share. */
export function monthlyPrice(plan, interval) {
  return interval === "year" ? plan.price.year / 12 : plan.price.month;
}

/** "$12" or "$14.50" — whole dollars without decimals. */
export function formatUsd(amount) {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}
