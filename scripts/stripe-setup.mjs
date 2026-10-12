#!/usr/bin/env node
/**
 * Create ClipCore's products and prices in Stripe, from src/lib/plans.js.
 *
 *   npm run stripe:setup
 *   npm run stripe:setup -- --webhook https://yourdomain.com/api/webhook/stripe
 *
 * Works in test or live mode, whichever STRIPE_SECRET_KEY is. Safe to run
 * again: products are found by metadata and prices by lookup key; a price
 * whose amount changed gets a new Price that takes over the lookup key.
 *
 * --webhook also creates the webhook endpoint and prints its signing secret
 * (Stripe shows that secret only once). For local development use the Stripe
 * CLI instead: stripe listen --forward-to localhost:3000/api/webhook/stripe
 */
import "../worker/lib/env.js";
import Stripe from "stripe";
import { PLANS, PAID_PLAN_IDS, INTERVALS, lookupKey } from "../src/lib/plans.js";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY in .env first (Stripe Dashboard → Developers → API keys).");
  process.exit(1);
}
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live_") ? "LIVE" : "test";
console.log(`Stripe ${mode} mode\n`);

const { data: products } = await stripe.products.list({ active: true, limit: 100 });

for (const planId of PAID_PLAN_IDS) {
  const plan = PLANS[planId];
  let product = products.find((p) => p.metadata?.clipcore_plan === planId);
  if (!product) {
    product = await stripe.products.create({
      name: `ClipCore ${plan.name}`,
      description: plan.minutes == null ? "Unlimited minutes of video per month (fair use)" : `${plan.minutes} minutes of video per month`,
      metadata: { clipcore_plan: planId },
    });
    console.log(`created product  ${product.name}`);
  }

  for (const interval of INTERVALS) {
    const lookup = lookupKey(planId, interval);
    const cents = Math.round(plan.price[interval] * 100);
    const { data: existing } = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 });

    if (existing[0]?.unit_amount === cents && existing[0]?.recurring?.interval === interval) {
      console.log(`  ok             ${lookup}  $${plan.price[interval]}/${interval}`);
      continue;
    }

    await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: cents,
      recurring: { interval },
      lookup_key: lookup,
      transfer_lookup_key: true,
      metadata: { clipcore_plan: planId, interval },
    });
    if (existing[0]) await stripe.prices.update(existing[0].id, { active: false });
    console.log(`  created price  ${lookup}  $${plan.price[interval]}/${interval}`);
  }
}

const webhookIndex = process.argv.indexOf("--webhook");
if (webhookIndex !== -1) {
  const url = process.argv[webhookIndex + 1];
  if (!/^https:\/\//.test(url || "")) {
    console.error("\n--webhook needs an https URL, e.g. https://yourdomain.com/api/webhook/stripe");
    process.exit(1);
  }
  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "customer.subscription.paused",
      "customer.subscription.resumed",
    ],
  });
  console.log(`\nWebhook created for ${url}`);
  console.log(`Set this in your production environment (shown only once):\n  STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
}

console.log("\nDone.");
