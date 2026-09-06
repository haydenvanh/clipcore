import { NextResponse } from "next/server";
import { BillingService } from "@/lib/services/billing";
import { getPlan } from "@/lib/plans";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";

export const POST = handler("BILLING_CHECKOUT", async (req) => {
  const user = await requireUser();

  const { planId } = await readJson(req);
  const plan = getPlan(planId);
  if (!plan) {
    throw new ApiError(400, "Choose one of: Basic, Pro, or Ultra.");
  }

  const { url, changedExisting } = await BillingService.createCheckoutSession(user.id, plan.id);
  if (!url) throw new ApiError(502, "Stripe did not return a checkout URL.");

  // An existing subscriber is sent to the Portal instead, where Stripe handles
  // proration properly. The flag lets the UI explain the redirect.
  return NextResponse.json({ url, changedExisting });
});
