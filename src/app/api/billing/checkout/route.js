import { NextResponse } from "next/server";
import { BillingService } from "@/lib/services/billing";
import { getPlan } from "@/lib/plans";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

export const POST = handler("BILLING_CHECKOUT", async (req) => {
  const user = await requireUser();
  await enforceRateLimit("billing", user.id);

  const { planId, interval } = await readJson(req);
  const plan = getPlan(planId);
  if (!plan) {
    throw new ApiError(400, "Choose one of: Basic, Pro, or Ultra.");
  }

  const billingInterval = interval === "YEAR" ? "YEAR" : "MONTH";

  const { url, changedExisting } = await BillingService.createCheckoutSession(
    user.id,
    plan.id,
    billingInterval
  );
  if (!url) throw new ApiError(502, "Stripe did not return a checkout URL.");

  // An existing subscriber is sent to the Portal instead, where Stripe handles
  // proration properly. The flag lets the UI explain the redirect.
  return NextResponse.json({ url, changedExisting });
});
