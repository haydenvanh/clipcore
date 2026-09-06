import { NextResponse } from "next/server";
import { AIService } from "@/lib/services/ai";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";

export const POST = handler("AI_CLIPPING_STATUS", async (req) => {
  const user = await requireUser();

  const { requestId } = await readJson(req);
  if (!requestId) throw new ApiError(400, "requestId is required.");

  // Scoped to the caller: looking the job up by requestId alone let any user
  // read any other user's result URLs.
  const result = await AIService.checkStatus(requestId, user.id);
  if (result.status === "not_found") throw new ApiError(404, "Job not found.");

  return NextResponse.json(result);
});
