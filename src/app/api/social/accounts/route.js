import { NextResponse } from "next/server";
import { SocialService } from "@/lib/services/social";
import { handler, requireUser } from "@/lib/api";

/** The caller's connected accounts. Token material is never included. */
export const GET = handler("SOCIAL_ACCOUNTS", async () => {
  const user = await requireUser();
  const accounts = await SocialService.listConnections(user.id);
  return NextResponse.json({ accounts });
});
