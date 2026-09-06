import { NextResponse } from "next/server";
import { BillingService } from "@/lib/services/billing";

// The signature is computed over the exact bytes Stripe sent, so this route
// must read the raw body and must not run on a runtime that re-encodes it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  // Read the header off the request rather than next/headers: headers() is
  // async in Next 16, and the previous handler called it synchronously and
  // threw on every delivery.
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text();

  try {
    const result = await BillingService.handleWebhook(rawBody, signature);
    return NextResponse.json(result);
  } catch (error) {
    if (error.type === "StripeSignatureVerificationError") {
      console.warn("[STRIPE_WEBHOOK] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    // 500 makes Stripe retry. Handlers are idempotent, so a retry is safe.
    console.error("[STRIPE_WEBHOOK]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
