import { NextResponse } from "next/server";
import { listProviders } from "@/lib/social";
import { handler, requireUser } from "@/lib/api";

/** Every destination, with whether it is built and configured. */
export const GET = handler("SOCIAL_PROVIDERS", async () => {
  await requireUser();
  return NextResponse.json({ providers: listProviders() });
});
