import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUsableProvider } from "@/lib/social";
import { randomToken } from "@/lib/crypto";
import config from "@/lib/config";
import { handler, requireUser } from "@/lib/api";

export const runtime = "nodejs";

const STATE_COOKIE = "clipcore_oauth_state";

/**
 * Begin an OAuth connect flow.
 *
 * The `state` value is generated here, stored in an httpOnly cookie, and
 * compared on the way back. Without that check anyone could hand the user a
 * crafted callback URL and attach their own channel to the user's account.
 */
export const GET = handler("SOCIAL_CONNECT", async (req, ctx) => {
  const user = await requireUser();

  // params is a Promise in Next 16.
  const { provider: providerId } = await ctx.params;
  const provider = requireUsableProvider(providerId);

  const state = randomToken(32);
  const redirectUri = `${config.auth.url}/api/social/callback/${provider.id.toLowerCase()}`;

  const jar = await cookies();
  jar.set(STATE_COOKIE, `${state}:${user.id}:${provider.id}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must survive the cross-site redirect back from Google
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(provider.getAuthorizationUrl({ state, redirectUri }));
});

export { STATE_COOKIE };
