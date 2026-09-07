import { SocialProvider } from "./provider.js";

/**
 * Instagram Reels — not implemented yet.
 *
 * What implementing this requires (Instagram Graph API):
 *   - A Business or Creator account linked to a Facebook Page; personal
 *     accounts cannot publish through the API at all.
 *   - Scopes: instagram_business_content_publish, pages_show_list.
 *   - Two-step publish: create a REELS media container from a publicly
 *     reachable video URL, poll it until status_code is FINISHED, then publish.
 *     R2 objects therefore need a signed URL that Meta's fetcher can reach.
 *   - A 25-posts-per-24h rate limit per account, which the publish job must
 *     respect or the whole app's quota is burned by one user.
 */
export class InstagramProvider extends SocialProvider {
  static id = "INSTAGRAM";
  static displayName = "Instagram Reels";
  static implemented = false;

  static supportedAspectRatios = ["RATIO_9_16"];
  static maxDurationSec = 900;
  static maxSizeBytes = 1024 * 1024 * 1024;
  static privacyOptions = ["public"];

  isConfigured() {
    return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
  }
}
