import { NextResponse } from "next/server";
import { AIService } from "@/lib/services/ai";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";

export const POST = handler("YOUTUBE_DOWNLOAD", async (req) => {
  const user = await requireUser();

  const { video_url, format } = await readJson(req);
  if (!video_url) throw new ApiError(400, "A video URL is required.");

  const result = await AIService.youtubeDownload(user.id, {
    video_url,
    format: format || "720",
  });

  return NextResponse.json(result);
});
