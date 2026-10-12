import Stripe from "stripe";
import { ApiError } from "@/lib/api";

/**
 * The Stripe client, or a clear 503 when billing isn't configured yet — so
 * the rest of the app keeps working on a machine without Stripe keys.
 */
let client = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new ApiError(503, "Payments aren't set up yet.");
  if (!client) client = new Stripe(key, { appInfo: { name: "ClipCore" } });
  return client;
}

/** The public address of the app, for Stripe's return links. */
export function appUrl() {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}
