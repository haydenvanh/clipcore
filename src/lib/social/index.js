import { YouTubeProvider } from "./youtube.js";
import { TikTokProvider } from "./tiktok.js";
import { InstagramProvider } from "./instagram.js";
import { FacebookProvider } from "./facebook.js";
import { SocialProvider, NotImplementedError, SocialAuthError, SocialPublishError } from "./provider.js";

/**
 * Provider registry.
 *
 * One instance per provider, created once. Callers resolve by the same
 * SocialProvider enum value the database stores, so there is no string mapping
 * layer to drift.
 */

const registry = new Map([
  ["YOUTUBE", new YouTubeProvider()],
  ["TIKTOK", new TikTokProvider()],
  ["INSTAGRAM", new InstagramProvider()],
  ["FACEBOOK", new FacebookProvider()],
]);

/** @returns {SocialProvider|null} */
export function getProvider(id) {
  if (typeof id !== "string") return null;
  return registry.get(id.toUpperCase()) ?? null;
}

/**
 * The provider, or a thrown error explaining precisely why it is unusable —
 * "not built yet" and "not configured on this deployment" are different
 * problems with different fixes, and the user deserves to know which they hit.
 */
export function requireUsableProvider(id) {
  const provider = getProvider(id);
  if (!provider) {
    throw new NotImplementedError(String(id), "connect");
  }
  if (!provider.constructor.implemented) {
    const error = new NotImplementedError(provider.constructor.displayName, "publishing");
    error.message = `${provider.constructor.displayName} support is coming soon.`;
    throw error;
  }
  if (!provider.isConfigured()) {
    const error = new Error(
      `${provider.constructor.displayName} is not configured on this deployment.`
    );
    error.status = 503;
    throw error;
  }
  return provider;
}

/** Everything the UI needs to render the connections page. */
export function listProviders() {
  return [...registry.values()].map((provider) => provider.describe());
}

/** Providers that can actually be connected right now. */
export function availableProviders() {
  return listProviders().filter((p) => p.implemented && p.configured);
}

export {
  SocialProvider, NotImplementedError, SocialAuthError, SocialPublishError,
  YouTubeProvider, TikTokProvider, InstagramProvider, FacebookProvider,
};
