import { NextResponse } from "next/server";
import { AIService } from "@/lib/services/ai";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";

export const POST = handler("AI_CLIPPING", async (req) => {
  const user = await requireUser();

  const { video_url, num_highlights, aspect_ratio } = await readJson(req);
  if (!video_url) throw new ApiError(400, "A video URL is required.");

  const result = await AIService.aiClipping(user.id, {
    video_url,
    num_highlights,
    aspect_ratio,
  });

  return NextResponse.json(result);
});
