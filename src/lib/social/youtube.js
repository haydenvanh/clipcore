import { SocialProvider, SocialAuthError, SocialPublishError } from "./provider.js";

/**
 * YouTube, via the Data API v3.
 *
 * Connecting is a separate OAuth grant from signing in, even though both go
 * through Google. Two reasons: asking for upload permission during signup is a
 * conversion killer, and NextAuth's Account row is adapter-owned identity that
 * we should not repurpose as a publishing credential with its own lifecycle.
 *
 * Uploads use the resumable protocol rather than a single multipart POST. A
 * 60-second 1080p clip is tens of megabytes; a plain POST that dies at 90%
 * starts over, while a resumable session can be continued.
 */

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API_BASE = "https://www.googleapis.com/youtube/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export class YouTubeProvider extends SocialProvider {
  static id = "YOUTUBE";
  static displayName = "YouTube";
  static implemented = true;

  // Shorts are 9:16 and <=3 minutes; the same endpoint takes normal uploads,
  // so 1:1 and 16:9 are accepted too.
  static supportedAspectRatios = ["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"];
  static maxDurationSec = 900;
  static maxSizeBytes = 256 * 1024 * 1024 * 1024; // 256 GB, YouTube's documented cap
  static privacyOptions = ["public", "unlisted", "private"];

  constructor({ clientId, clientSecret } = {}) {
    super();
    // Stored as explicit overrides only. Credentials are resolved lazily below
    // rather than captured here: the registry constructs one instance at module
    // load, so reading env in the constructor would freeze whatever was set at
    // import time and ignore anything the runtime supplies afterwards.
    this.overrides = { clientId, clientSecret };
  }

  get clientId() {
    return (
      this.overrides.clientId ??
      // Falls back to the sign-in credentials: it is the same Google project,
      // and requiring a second app registration for no reason is friction.
      process.env.YOUTUBE_CLIENT_ID ??
      process.env.GOOGLE_CLIENT_ID ??
      null
    );
  }

  get clientSecret() {
    return (
      this.overrides.clientSecret ??
      process.env.YOUTUBE_CLIENT_SECRET ??
      process.env.GOOGLE_CLIENT_SECRET ??
      null
    );
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  getAuthorizationUrl({ state, redirectUri }) {
    if (!this.isConfigured()) {
      throw new SocialAuthError("YouTube is not configured on this deployment.", {
        provider: this.id,
      });
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      state,
      // offline + consent is the only combination that reliably returns a
      // refresh token. Without prompt=consent Google omits it on every grant
      // after the first, and the connection silently dies in an hour.
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    });

    return `${OAUTH_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode({ code, redirectUri }) {
    const response = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new SocialAuthError(`Could not connect YouTube: ${detail.slice(0, 300)}`, {
        provider: this.id,
      });
    }

    const token = await response.json();

    // A user can untick scopes on the consent screen. Catch that here rather
    // than at the first failed upload.
    const granted = String(token.scope || "").split(/\s+/);
    if (!granted.includes("https://www.googleapis.com/auth/youtube.upload")) {
      throw new SocialAuthError(
        "Upload permission was not granted. Reconnect and allow YouTube uploads.",
        { provider: this.id }
      );
    }

    const channel = await this.fetchChannel(token.access_token);

    return {
      externalId: channel.id,
      displayName: channel.title,
      avatarUrl: channel.avatarUrl,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      scope: token.scope ?? null,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      metadata: { customUrl: channel.customUrl, subscriberCount: channel.subscriberCount },
    };
  }

  /** The channel the token belongs to. */
  async fetchChannel(accessToken) {
    const response = await fetch(
      `${API_BASE}/channels?part=snippet,statistics&mine=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new SocialAuthError(`Could not read your YouTube channel: ${detail.slice(0, 300)}`, {
        provider: this.id,
      });
    }

    const data = await response.json();
    const channel = data.items?.[0];
    if (!channel) {
      throw new SocialAuthError(
        "That Google account has no YouTube channel. Create one, then reconnect.",
        { provider: this.id }
      );
    }

    return {
      id: channel.id,
      title: channel.snippet?.title ?? "YouTube channel",
      avatarUrl: channel.snippet?.thumbnails?.default?.url ?? null,
      customUrl: channel.snippet?.customUrl ?? null,
      subscriberCount: channel.statistics?.subscriberCount ?? null,
    };
  }

  async refreshAccessToken({ refreshToken }) {
    if (!refreshToken) {
      throw new SocialAuthError("No refresh token — reconnect this channel.", {
        provider: this.id,
        needsReconnect: true,
      });
    }

    const response = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const detail = await response.text();
      // invalid_grant means the user revoked access or the token expired for
      // good. That is unrecoverable without a new consent, so flag it as such
      // instead of retrying forever.
      const needsReconnect = detail.includes("invalid_grant");
      throw new SocialAuthError(
        needsReconnect
          ? "YouTube access was revoked. Reconnect the channel to keep publishing."
          : `Could not refresh YouTube access: ${detail.slice(0, 200)}`,
        { provider: this.id, needsReconnect }
      );
    }

    const token = await response.json();
    return {
      accessToken: token.access_token,
      // Google usually omits refresh_token on refresh; keep the existing one.
      refreshToken: token.refresh_token ?? refreshToken,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    };
  }

  /**
   * Upload a video with the resumable protocol.
   *
   * Two requests: one to open a session and register the metadata, then the
   * bytes. Splitting them means a network failure mid-upload can be continued
   * against the same session URL rather than re-sending everything.
   */
  async publish({ accessToken, videoStream, sizeBytes, title, description, tags, privacy = "public" }) {
    const metadata = {
      snippet: {
        title: String(title || "Untitled clip").slice(0, 100),
        description: String(description || "").slice(0, 5000),
        // YouTube rejects the whole request if the tag list exceeds 500 chars.
        tags: Array.isArray(tags) ? tags.map((t) => String(t).slice(0, 30)).slice(0, 15) : undefined,
        categoryId: "22", // People & Blogs
      },
      status: {
        privacyStatus: YouTubeProvider.privacyOptions.includes(privacy) ? privacy : "private",
        selfDeclaredMadeForKids: false,
      },
    };

    const initResponse = await fetch(
      `${UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(sizeBytes),
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!initResponse.ok) {
      const detail = await initResponse.text();
      throw new SocialPublishError(`YouTube rejected the upload: ${detail.slice(0, 300)}`, {
        provider: this.id,
        // 5xx and 429 are worth retrying; a 400 means the metadata is wrong and
        // retrying changes nothing.
        retryable: initResponse.status >= 500 || initResponse.status === 429,
      });
    }

    const sessionUrl = initResponse.headers.get("location");
    if (!sessionUrl) {
      throw new SocialPublishError("YouTube did not return an upload session.", {
        provider: this.id,
        retryable: true,
      });
    }

    const uploadResponse = await fetch(sessionUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "video/mp4",
        "Content-Length": String(sizeBytes),
      },
      body: videoStream,
      // Required by undici when the body is a stream.
      duplex: "half",
      signal: AbortSignal.timeout(30 * 60 * 1000),
    });

    if (!uploadResponse.ok) {
      const detail = await uploadResponse.text();
      throw new SocialPublishError(`YouTube upload failed: ${detail.slice(0, 300)}`, {
        provider: this.id,
        retryable: uploadResponse.status >= 500,
      });
    }

    const video = await uploadResponse.json();

    return {
      externalId: video.id,
      externalUrl: `https://www.youtube.com/watch?v=${video.id}`,
      // The upload succeeded but YouTube still has to transcode; the post is
      // not watchable yet, so this is not PUBLISHED.
      status: video.status?.uploadStatus === "processed" ? "PUBLISHED" : "PROCESSING",
    };
  }

  async checkStatus({ accessToken, externalId }) {
    const response = await fetch(
      `${API_BASE}/videos?part=status,processingDetails&id=${encodeURIComponent(externalId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!response.ok) {
      throw new SocialPublishError("Could not read the video's status.", {
        provider: this.id,
        retryable: true,
      });
    }

    const video = (await response.json()).items?.[0];
    if (!video) return { status: "FAILED", externalUrl: null };

    const uploadStatus = video.status?.uploadStatus;
    if (uploadStatus === "processed") {
      return { status: "PUBLISHED", externalUrl: `https://www.youtube.com/watch?v=${externalId}` };
    }
    if (uploadStatus === "failed" || uploadStatus === "rejected") {
      return { status: "FAILED", externalUrl: null };
    }
    return { status: "PROCESSING", externalUrl: null };
  }

  async revoke({ accessToken }) {
    try {
      await fetch(OAUTH_REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: accessToken }),
        signal: AbortSignal.timeout(10_000),
      });
      return { revoked: true };
    } catch {
      // The row is deleted either way; a failed revoke must not block the user
      // from disconnecting.
      return { revoked: false };
    }
  }
}

export { SCOPES as YOUTUBE_SCOPES };
