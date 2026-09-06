import { NextResponse } from "next/server";
import { BillingService } from "@/lib/services/billing";
import { ApiError, handler, requireUser } from "@/lib/api";

export const POST = handler("BILLING_PORTAL", async () => {
  const user = await requireUser();

  const url = await BillingService.createPortalSession(user.id);
  if (!url) throw new ApiError(502, "Stripe did not return a portal URL.");

  return NextResponse.json({ url });
});
