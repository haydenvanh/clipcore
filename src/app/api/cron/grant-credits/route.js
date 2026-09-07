import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { BillingService } from "@/lib/services/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Monthly credit grant for annual subscribers.
 *
 * Monthly plans get credits from invoice.paid; an annual plan only produces one
 * invoice a year, so this is what keeps its allowance arriving each month.
 *
 * Schedule it daily — the work is idempotent per subscription per month, so
 * running it more often than needed grants nothing extra, and missing a day
 * just means the grant lands the next.
 */
function authorized(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  // Vercel Cron sends this header; a manual call can use ?token=.
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(req.url).searchParams.get("token") ||
    "";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req) {
  if (!authorized(req)) {
    // Fail closed: an open endpoint that mints credits is not something to
    // leave running if CRON_SECRET was forgotten.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await BillingService.grantDueCredits();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[CRON_GRANT_CREDITS]", error);
    return NextResponse.json({ error: "Grant run failed" }, { status: 500 });
  }
}
