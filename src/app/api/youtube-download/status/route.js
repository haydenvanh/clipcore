import { NextResponse } from "next/server";
import { AIService } from "@/lib/services/ai";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";

// This route had no session check at all — it was a fully public read of any
// job's result URLs.
export const POST = handler("YOUTUBE_DOWNLOAD_STATUS", async (req) => {
  const user = await requireUser();

  const { requestId } = await readJson(req);
  if (!requestId) throw new ApiError(400, "requestId is required.");

  const result = await AIService.checkStatus(requestId, user.id);
  if (result.status === "not_found") throw new ApiError(404, "Job not found.");

  return NextResponse.json(result);
});
