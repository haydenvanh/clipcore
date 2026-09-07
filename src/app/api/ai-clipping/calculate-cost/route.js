import { NextResponse } from "next/server";
import { AIService } from "@/lib/services/ai";
import { handler, readJson, requireUser } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

// Previously unauthenticated, and it performed a server-side fetch on any URL
// the caller supplied: an anonymous SSRF and a free outbound-request proxy.
export const POST = handler("CALCULATE_COST", async (req) => {
  const user = await requireUser();
  await enforceRateLimit("status", user.id);

  const { video_url, num_highlights } = await readJson(req);
  if (!video_url) return NextResponse.json({ cost: 0, estimated: true });

  const result = await AIService.calculateClippingCost(video_url, num_highlights);
  return NextResponse.json(result);
});
