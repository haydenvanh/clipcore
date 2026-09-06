import Stripe from "stripe";
import config from "./config";

/**
 * Lazily constructed Stripe client.
 *
 * Two failure modes to avoid:
 *   - The old code substituted a fake key when none was set, so a misconfigured
 *     production deploy failed mysteriously on a customer's first payment.
 *   - Throwing at module scope breaks `next build`, which evaluates every route
 *     module with NODE_ENV=production but without runtime secrets.
 *
 * So: no key is tolerated at import time, and refused loudly the first time the
 * client is actually used.
 */

let client = null;

export const isStripeConfigured = Boolean(config.stripe.secretKey);

export function getStripe() {
  if (!config.stripe.secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Billing is unavailable until it is set."
    );
  }
  if (!client) {
    // No apiVersion pin: the SDK's default is current and supported. The
    // previous "2023-10-16" pin was three years behind the installed SDK.
    client = new Stripe(config.stripe.secretKey, {
      appInfo: { name: "ClipCore", version: "1.0.0" },
    });
  }
  return client;
}

/**
 * Ergonomic wrapper so call sites read as `stripe.customers.create(...)` while
 * the underlying client is still built on first use.
 */
export const stripe = new Proxy(
  {},
  {
    get(_target, prop) {
      const value = getStripe()[prop];
      return typeof value === "function" ? value.bind(getStripe()) : value;
    },
  }
);
