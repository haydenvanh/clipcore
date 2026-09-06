import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import config from "@/lib/config";
import { AIService } from "@/lib/services/ai";
import { CreditService } from "@/lib/services/credits";

export const runtime = "nodejs";

/** Constant-time string compare, safe for inputs of differing length. */
function secretsMatch(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Provider callback.
 *
 * This endpoint was previously unauthenticated: any internet caller could POST
 * `{ id, outputs: ["https://attacker/x.mp4"] }` and overwrite an arbitrary
 * user's completed clip, or flip live jobs to failed. MuAPI does not sign its
 * callbacks, so we authenticate with a shared secret that we put in the
 * callback URL when the job is submitted (see AIService.submitToMuapi).
 */
export async function POST(req) {
  const expected = config.ai.aiclips.webhookSecret;

  if (!expected) {
    // Fail closed. An unauthenticated write path is worse than a missed callback;
    // the client's status poll will still resolve the job.
    console.error("[MUAPI_WEBHOOK] MUAPI_WEBHOOK_SECRET is not configured — rejecting callback.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const token =
    new URL(req.url).searchParams.get("token") ||
    req.headers.get("x-webhook-token");

  if (!secretsMatch(token || "", expected)) {
    console.warn("[MUAPI_WEBHOOK] Rejected callback with invalid token.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const requestId = data.id || data.request_id;

    if (!requestId) {
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }

    const creation = await prisma.creation.findUnique({ where: { requestId } });

    if (!creation) {
      console.warn(`[MUAPI_WEBHOOK] No creation for requestId ${requestId}.`);
      return NextResponse.json({ error: "Creation not found" }, { status: 404 });
    }

    // Idempotency: a provider retry must not refund twice or overwrite a
    // settled result.
    if (creation.status === "completed" || creation.status === "failed") {
      return NextResponse.json({ success: true, deduplicated: true });
    }

    if (data.error) {
      await prisma.creation.update({
        where: { id: creation.id },
        data: { status: "failed", error: String(data.error).slice(0, 2000) },
      });
      await CreditService.refund(creation.userId, creation.creditsCharged ?? 0, {
        refType: "creation",
        refId: creation.requestId,
        description: "Provider reported failure",
      });
    } else {
      await prisma.creation.update({
        where: { id: creation.id },
        data: {
          status: "completed",
          resultUrl: JSON.stringify(AIService.extractMediaUrls(data)),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MUAPI_WEBHOOK]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
