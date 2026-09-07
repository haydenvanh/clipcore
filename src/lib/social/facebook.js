import { SocialProvider } from "./provider.js";

/**
 * Facebook Reels — not implemented yet.
 *
 * What implementing this requires (Facebook Graph API):
 *   - Publishing targets a Page, not a person, so the connect flow must let the
 *     user pick which Page and must exchange the user token for a long-lived
 *     Page access token.
 *   - Scopes: pages_manage_posts, pages_read_engagement, publish_video.
 *   - Three-step resumable upload: start a session, upload the bytes, finish
 *     with the description and publish state.
 *   - Shares an app review and rate-limit budget with Instagram, so both should
 *     land together once Meta app review is done.
 */
export class FacebookProvider extends SocialProvider {
  static id = "FACEBOOK";
  static displayName = "Facebook Reels";
  static implemented = false;

  static supportedAspectRatios = ["RATIO_9_16"];
  static maxDurationSec = 5400;
  static maxSizeBytes = 10 * 1024 * 1024 * 1024;
  static privacyOptions = ["public", "private"];

  isConfigured() {
    return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }
}
