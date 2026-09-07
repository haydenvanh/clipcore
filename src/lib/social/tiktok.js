import { SocialProvider } from "./provider.js";

/**
 * TikTok — not implemented yet.
 *
 * Every method inherits the base class's NotImplementedError, so calling one
 * fails immediately with a clear message rather than returning undefined and
 * breaking somewhere else. The static metadata below is real and is used today
 * to render the "coming soon" card and to reject renders that TikTok would not
 * accept anyway.
 *
 * What implementing this requires (Content Posting API v2):
 *   - App review before the Direct Post scope is granted; the sandbox only
 *     allows posting to private drafts.
 *   - Scopes: video.upload (draft) and video.publish (direct post).
 *   - PULL_FROM_URL upload, so R2 objects need a public or signed URL that
 *     TikTok's fetcher can reach.
 *   - Creator info must be queried first: the API rejects a post whose privacy
 *     level is not in that creator's allowed list.
 *   - Tokens expire in 24h; the refresh token in 365 days.
 */
export class TikTokProvider extends SocialProvider {
  static id = "TIKTOK";
  static displayName = "TikTok";
  static implemented = false;

  static supportedAspectRatios = ["RATIO_9_16"];
  static maxDurationSec = 600;
  static maxSizeBytes = 4 * 1024 * 1024 * 1024;
  static privacyOptions = ["public", "friends", "private"];

  isConfigured() {
    return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  }
}
