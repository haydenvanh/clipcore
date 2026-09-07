import { NextResponse } from "next/server";
import { SocialService } from "@/lib/services/social";
import { ApiError, handler, requireUser } from "@/lib/api";

/** Disconnect an account: revoke upstream where possible, then delete it. */
export const DELETE = handler("SOCIAL_DISCONNECT", async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const result = await SocialService.disconnect(user.id, id);
  if (!result.deleted) throw new ApiError(404, "Connection not found.");

  return NextResponse.json({ disconnected: true });
});
