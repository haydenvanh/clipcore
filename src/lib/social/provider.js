/**
 * The contract every social destination implements.
 *
 * Written as an abstract class rather than a loose object so that a stub cannot
 * silently half-exist: an unimplemented provider inherits methods that throw
 * NotImplementedError with a clear message, instead of returning undefined and
 * failing three layers away.
 *
 * The shape is deliberately the same for every platform even though their APIs
 * are not, because the caller (a publish job, a UI button) should not branch on
 * which platform it is talking to.
 */

export class NotImplementedError extends Error {
  constructor(provider, method) {
    super(`${provider} does not support ${method} yet.`);
    this.name = "NotImplementedError";
    this.provider = provider;
    this.method = method;
    this.status = 501;
  }
}

export class SocialAuthError extends Error {
  constructor(message, { provider, needsReconnect = false, cause } = {}) {
    super(message);
    this.name = "SocialAuthError";
    this.provider = provider;
    this.needsReconnect = needsReconnect;
    this.cause = cause;
    this.status = 401;
  }
}

export class SocialPublishError extends Error {
  constructor(message, { provider, retryable = false, cause } = {}) {
    super(message);
    this.name = "SocialPublishError";
    this.provider = provider;
    this.retryable = retryable;
    this.cause = cause;
    this.status = 502;
  }
}

/**
 * @typedef {object} ConnectedAccount
 * @property {string} externalId       channel/page/account id on the provider
 * @property {string} displayName
 * @property {string|null} avatarUrl
 * @property {string} accessToken      plaintext; the caller encrypts before storing
 * @property {string|null} refreshToken
 * @property {string|null} scope
 * @property {Date|null} expiresAt
 * @property {object} metadata         provider-specific extras
 *
 * @typedef {object} PublishResult
 * @property {string} externalId
 * @property {string|null} externalUrl
 * @property {"PUBLISHED"|"PROCESSING"} status  PROCESSING when the platform
 *   is still transcoding and the post is not yet live
 */

export class SocialProvider {
  /** @type {"YOUTUBE"|"TIKTOK"|"INSTAGRAM"|"FACEBOOK"} */
  static id = "UNKNOWN";
  static displayName = "Unknown";
  /** Whether this provider can be used at all right now. */
  static implemented = false;

  /** Aspect ratios this destination accepts, best first. */
  static supportedAspectRatios = ["RATIO_9_16"];
  /** Hard limit the platform enforces on a single video, in seconds. */
  static maxDurationSec = 60;
  /** Hard limit on upload size, in bytes. */
  static maxSizeBytes = 256 * 1024 * 1024;
  /** Privacy values the platform understands. */
  static privacyOptions = ["public", "private"];

  get id() {
    return this.constructor.id;
  }

  /**
   * Whether the provider is configured with credentials in this environment.
   * A provider can be implemented but not configured, and the UI needs to tell
   * those apart: one says "coming soon", the other says "ask the operator".
   * @returns {boolean}
   */
  isConfigured() {
    return false;
  }

  /**
   * The URL to send the user to in order to grant access.
   * @param {{state: string, redirectUri: string}} _params
   * @returns {string}
   */
  getAuthorizationUrl(_params) {
    throw new NotImplementedError(this.id, "getAuthorizationUrl");
  }

  /**
   * Exchange the callback code for tokens and identify the account.
   * @param {{code: string, redirectUri: string}} _params
   * @returns {Promise<ConnectedAccount>}
   */
  async exchangeCode(_params) {
    throw new NotImplementedError(this.id, "exchangeCode");
  }

  /**
   * Trade a refresh token for a fresh access token.
   * @param {{refreshToken: string}} _params
   * @returns {Promise<{accessToken: string, expiresAt: Date|null, refreshToken?: string}>}
   */
  async refreshAccessToken(_params) {
    throw new NotImplementedError(this.id, "refreshAccessToken");
  }

  /**
   * Publish a video.
   * @param {{accessToken: string, account: object, videoStream: import("node:stream").Readable,
   *          sizeBytes: number, title: string, description?: string, tags?: string[],
   *          privacy?: string}} _params
   * @returns {Promise<PublishResult>}
   */
  async publish(_params) {
    throw new NotImplementedError(this.id, "publish");
  }

  /**
   * Ask the platform whether a still-processing post has gone live.
   * @param {{accessToken: string, externalId: string}} _params
   * @returns {Promise<{status: string, externalUrl?: string|null}>}
   */
  async checkStatus(_params) {
    throw new NotImplementedError(this.id, "checkStatus");
  }

  /**
   * Best-effort token revocation on disconnect. Providers that offer no
   * revocation endpoint may no-op — the caller deletes the row regardless.
   * @param {{accessToken: string}} _params
   */
  async revoke(_params) {
    return { revoked: false };
  }

  /**
   * Reject a render the platform would reject anyway, before we spend an
   * upload on it.
   * @param {{durationSec: number, sizeBytes: number, aspectRatio: string}} render
   * @returns {{ok: boolean, reason?: string}}
   */
  validateRender({ durationSec, sizeBytes, aspectRatio }) {
    const Provider = this.constructor;

    if (durationSec > Provider.maxDurationSec) {
      return {
        ok: false,
        reason: `${Provider.displayName} accepts videos up to ${Provider.maxDurationSec} seconds; this clip is ${Math.round(durationSec)}s.`,
      };
    }
    if (sizeBytes > Provider.maxSizeBytes) {
      return {
        ok: false,
        reason: `${Provider.displayName} accepts uploads up to ${Math.round(Provider.maxSizeBytes / 1024 / 1024)} MB.`,
      };
    }
    if (aspectRatio && !Provider.supportedAspectRatios.includes(aspectRatio)) {
      return {
        ok: false,
        reason: `${Provider.displayName} does not accept ${aspectRatio.replace("RATIO_", "").replace("_", ":")} clips.`,
      };
    }
    return { ok: true };
  }

  /** What the UI needs to render this provider's card. */
  describe() {
    const Provider = this.constructor;
    return {
      id: Provider.id,
      displayName: Provider.displayName,
      implemented: Provider.implemented,
      configured: this.isConfigured(),
      supportedAspectRatios: Provider.supportedAspectRatios,
      maxDurationSec: Provider.maxDurationSec,
      maxSizeBytes: Provider.maxSizeBytes,
      privacyOptions: Provider.privacyOptions,
    };
  }
}
