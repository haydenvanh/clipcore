import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUsableProvider } from "@/lib/social";
import { safeCompare } from "@/lib/crypto";
import { SocialService } from "@/lib/services/social";
import { prisma } from "@/lib/prisma";
import config from "@/lib/config";
import { requireUser } from "@/lib/api";

export const runtime = "nodejs";

const STATE_COOKIE = "clipcore_oauth_state";

/** Send the user back to the connections page with a readable message. */
function backToSettings(message, ok = false) {
  const url = new URL("/dashboard/connections", config.auth.url);
  url.searchParams.set(ok ? "connected" : "error", message);
  return NextResponse.redirect(url);
}

/**
 * OAuth callback.
 *
 * Verifies the state cookie before doing anything with the code, and clears it
 * either way so a stale value cannot be replayed.
 */
export async function GET(req, ctx) {
  const jar = await cookies();
  const cookieValue = jar.get(STATE_COOKIE)?.value ?? "";
  jar.delete(STATE_COOKIE);

  try {
    const user = await requireUser();
    const { provider: providerId } = await ctx.params;
    const provider = requireUsableProvider(providerId);

    const params = new URL(req.url).searchParams;

    if (params.get("error")) {
      return backToSettings(
        params.get("error") === "access_denied"
          ? "You declined the permission request."
          : "The provider returned an error."
      );
    }

    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return backToSettings("The callback was missing required values.");

    const [expectedState, cookieUserId, cookieProvider] = cookieValue.split(":");

    // Constant-time compare, and the cookie must also match the signed-in user
    // and the provider being connected.
    if (
      !expectedState ||
      !safeCompare(state, expectedState) ||
      cookieUserId !== user.id ||
      cookieProvider !== provider.id
    ) {
      return backToSettings("That connection link was invalid or expired. Try again.");
    }

    const redirectUri = `${config.auth.url}/api/social/callback/${provider.id.toLowerCase()}`;
    const account = await provider.exchangeCode({ code, redirectUri });

    await SocialService.saveConnection(user.id, provider.id, account);

    await prisma.event.create({
      data: {
        userId: user.id,
        type: "social_connected",
        payload: { provider: provider.id, externalId: account.externalId },
      },
    }).catch(() => {});

    return backToSettings(account.displayName || provider.constructor.displayName, true);
  } catch (error) {
    console.error("[SOCIAL_CALLBACK]", error);
    return backToSettings(error.message || "Could not complete the connection.");
  }
}
