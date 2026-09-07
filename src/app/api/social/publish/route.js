import { NextResponse } from "next/server";
import { SocialService } from "@/lib/services/social";
import { Queue, JOB_TYPES } from "@/lib/queue";
import { ApiError, handler, readJson, requireUser } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Queue a clip for publishing.
 *
 * Returns immediately with a Publication row; the worker does the upload. An
 * HTTP request cannot hold open long enough for a video upload, and the user
 * should not have to keep the tab open either.
 */
export const POST = handler("SOCIAL_PUBLISH", async (req) => {
  const user = await requireUser();
  await enforceRateLimit("publish", user.id);

  const { renderId, socialAccountId, title, description, tags, privacy } = await readJson(req);
  if (!renderId || !socialAccountId) {
    throw new ApiError(400, "renderId and socialAccountId are required.");
  }

  const publication = await SocialService.createPublication(user.id, {
    renderId, socialAccountId, title, description, tags, privacy,
  });

  await Queue.enqueue({
    type: JOB_TYPES.PUBLISH,
    payload: { publicationId: publication.id },
    refType: "publication",
    refId: publication.id,
  });

  return NextResponse.json({
    publicationId: publication.id,
    status: publication.status,
  });
});
