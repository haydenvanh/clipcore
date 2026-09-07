import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

const { encrypt, decrypt, isEncrypted, safeCompare, randomToken, hashToken } =
  await import("@/lib/crypto");
const { SocialProvider, NotImplementedError, SocialAuthError } =
  await import("@/lib/social/provider");
const { YouTubeProvider } = await import("@/lib/social/youtube");
const { TikTokProvider } = await import("@/lib/social/tiktok");
const { InstagramProvider } = await import("@/lib/social/instagram");
const { FacebookProvider } = await import("@/lib/social/facebook");
const { getProvider, listProviders, availableProviders, requireUsableProvider } =
  await import("@/lib/social");

describe("crypto — tokens at rest", () => {
  it("round-trips a value", () => {
    const secret = "ya29.a0AfH6SMB-example-access-token";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produces different ciphertext each time, so equal tokens are not linkable", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("never leaves the plaintext visible in the ciphertext", () => {
    expect(encrypt("supersecret")).not.toContain("supersecret");
  });

  it("rejects tampered ciphertext instead of returning garbage", () => {
    const parts = encrypt("hello").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("rejects a malformed or unversioned payload", () => {
    expect(() => decrypt("not-encrypted")).toThrow(/Malformed/);
    expect(() => decrypt("v9.a.b.c")).toThrow(/Malformed/);
  });

  it("treats empty values as empty rather than throwing", () => {
    expect(encrypt("")).toBe("");
    expect(decrypt("")).toBe("");
  });

  it("recognises its own output", () => {
    expect(isEncrypted(encrypt("x"))).toBe(true);
    expect(isEncrypted("plain")).toBe(false);
  });

  it("refuses a key that is not 32 bytes", async () => {
    vi.resetModules();
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.from("tooshort").toString("base64");
    const mod = await import("@/lib/crypto?short");
    expect(() => mod.encrypt("x")).toThrow(/32 bytes/);
    process.env.ENCRYPTION_KEY = saved;
  });

  it("compares in constant time and handles length mismatch", () => {
    expect(safeCompare("abc", "abc")).toBe(true);
    expect(safeCompare("abc", "abd")).toBe(false);
    expect(safeCompare("abc", "abcd")).toBe(false);
    expect(safeCompare(null, "abc")).toBe(false);
  });

  it("generates distinct URL-safe tokens", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(randomToken());
  });

  it("hashes deterministically and one-way", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toContain("abc");
  });
});

describe("provider interface", () => {
  it("makes every unimplemented method fail loudly rather than return undefined", async () => {
    const bare = new SocialProvider();
    expect(() => bare.getAuthorizationUrl({})).toThrow(NotImplementedError);
    await expect(bare.exchangeCode({})).rejects.toThrow(NotImplementedError);
    await expect(bare.refreshAccessToken({})).rejects.toThrow(NotImplementedError);
    await expect(bare.publish({})).rejects.toThrow(NotImplementedError);
    await expect(bare.checkStatus({})).rejects.toThrow(NotImplementedError);
  });

  it("lets revoke no-op, because a failed revoke must not block disconnecting", async () => {
    expect(await new SocialProvider().revoke({})).toEqual({ revoked: false });
  });
});

describe("validateRender", () => {
  const yt = new YouTubeProvider();

  it("accepts a normal short", () => {
    expect(yt.validateRender({ durationSec: 45, sizeBytes: 20e6, aspectRatio: "RATIO_9_16" }).ok).toBe(true);
  });

  it("rejects a clip past the platform's duration cap, naming the limit", () => {
    const tiktok = new TikTokProvider();
    const result = tiktok.validateRender({ durationSec: 900, sizeBytes: 1e6, aspectRatio: "RATIO_9_16" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/600 seconds/);
  });

  it("rejects an aspect ratio the platform does not take", () => {
    const tiktok = new TikTokProvider();
    const result = tiktok.validateRender({ durationSec: 30, sizeBytes: 1e6, aspectRatio: "RATIO_16_9" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/16:9/);
  });

  it("rejects an oversized upload", () => {
    const ig = new InstagramProvider();
    const result = ig.validateRender({ durationSec: 30, sizeBytes: 5e9, aspectRatio: "RATIO_9_16" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/MB/);
  });
});

describe("registry", () => {
  it("resolves all four providers, case-insensitively", () => {
    for (const id of ["YOUTUBE", "TIKTOK", "INSTAGRAM", "FACEBOOK"]) {
      expect(getProvider(id)).toBeTruthy();
      expect(getProvider(id.toLowerCase())).toBeTruthy();
    }
    expect(getProvider("MYSPACE")).toBeNull();
    expect(getProvider(undefined)).toBeNull();
  });

  it("reports YouTube as the only implemented provider", () => {
    const byId = Object.fromEntries(listProviders().map((p) => [p.id, p]));
    expect(byId.YOUTUBE.implemented).toBe(true);
    expect(byId.TIKTOK.implemented).toBe(false);
    expect(byId.INSTAGRAM.implemented).toBe(false);
    expect(byId.FACEBOOK.implemented).toBe(false);
  });

  it("distinguishes 'not built' from 'not configured'", () => {
    const saved = { ...process.env };
    delete process.env.YOUTUBE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    // Built, but no credentials on this deployment -> 503.
    expect(() => requireUsableProvider("YOUTUBE")).toThrow(/not configured/);

    // Not built at all -> a different message.
    expect(() => requireUsableProvider("TIKTOK")).toThrow(/coming soon/);
    process.env = saved;
  });

  it("lists only usable providers as available", () => {
    const saved = { ...process.env };
    process.env.YOUTUBE_CLIENT_ID = "id";
    process.env.YOUTUBE_CLIENT_SECRET = "secret";
    expect(availableProviders().map((p) => p.id)).toEqual(["YOUTUBE"]);
    process.env = saved;
  });
});

describe("stubs", () => {
  it.each([
    ["TikTok", TikTokProvider],
    ["Instagram", InstagramProvider],
    ["Facebook", FacebookProvider],
  ])("%s throws NotImplementedError from every action", async (_name, Provider) => {
    const p = new Provider();
    expect(() => p.getAuthorizationUrl({})).toThrow(NotImplementedError);
    await expect(p.publish({})).rejects.toThrow(NotImplementedError);
  });

  it("still carries real platform limits, so the UI can be honest", () => {
    expect(TikTokProvider.maxDurationSec).toBe(600);
    expect(InstagramProvider.supportedAspectRatios).toEqual(["RATIO_9_16"]);
    expect(FacebookProvider.displayName).toBe("Facebook Reels");
  });
});

describe("YouTube OAuth", () => {
  let yt;
  const saved = { ...process.env };

  beforeAll(() => {
    process.env.YOUTUBE_CLIENT_ID = "client-id-123";
    process.env.YOUTUBE_CLIENT_SECRET = "client-secret-456";
    yt = new YouTubeProvider({ clientId: "client-id-123", clientSecret: "client-secret-456" });
  });

  afterEach(() => { vi.restoreAllMocks(); process.env = { ...saved, YOUTUBE_CLIENT_ID: "client-id-123", YOUTUBE_CLIENT_SECRET: "client-secret-456" }; });

  it("requests offline access and forced consent, or the refresh token never arrives", () => {
    const url = new URL(yt.getAuthorizationUrl({ state: "s1", redirectUri: "https://app/cb" }));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("scope")).toContain("youtube.upload");
  });

  it("refuses to build an auth URL when unconfigured", () => {
    const saved = { ...process.env };
    delete process.env.YOUTUBE_CLIENT_ID;
    delete process.env.YOUTUBE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const bare = new YouTubeProvider();
    expect(bare.isConfigured()).toBe(false);
    expect(() => bare.getAuthorizationUrl({ state: "s", redirectUri: "r" })).toThrow(SocialAuthError);

    process.env = saved;
  });

  it("resolves credentials at call time, not at construction", () => {
    const saved = { ...process.env };
    delete process.env.YOUTUBE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    // Constructed while unconfigured...
    const lazy = new YouTubeProvider();
    expect(lazy.isConfigured()).toBe(false);

    // ...becomes usable once the runtime supplies credentials.
    process.env.YOUTUBE_CLIENT_ID = "late-id";
    process.env.YOUTUBE_CLIENT_SECRET = "late-secret";
    expect(lazy.isConfigured()).toBe(true);

    process.env = saved;
  });

  it("rejects a grant that omitted the upload scope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "at", refresh_token: "rt", expires_in: 3600,
        scope: "https://www.googleapis.com/auth/youtube.readonly", // upload not granted
      }),
    });

    await expect(yt.exchangeCode({ code: "c", redirectUri: "r" }))
      .rejects.toThrow(/Upload permission was not granted/);
  });

  it("returns the channel identity on a good exchange", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "at", refresh_token: "rt", expires_in: 3600,
          scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{
            id: "UC123",
            snippet: { title: "My Channel", thumbnails: { default: { url: "https://img/a.jpg" } }, customUrl: "@mychannel" },
            statistics: { subscriberCount: "1234" },
          }],
        }),
      });

    const account = await yt.exchangeCode({ code: "c", redirectUri: "r" });
    expect(account).toMatchObject({
      externalId: "UC123", displayName: "My Channel", accessToken: "at", refreshToken: "rt",
    });
    expect(account.expiresAt).toBeInstanceOf(Date);
  });

  it("explains the Google-account-without-a-channel case", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "at", scope: "https://www.googleapis.com/auth/youtube.upload" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });

    await expect(yt.exchangeCode({ code: "c", redirectUri: "r" }))
      .rejects.toThrow(/no YouTube channel/);
  });

  it("flags invalid_grant as needing a reconnect, not a retry", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false, status: 400, text: async () => '{"error":"invalid_grant"}',
    });

    await expect(yt.refreshAccessToken({ refreshToken: "rt" })).rejects.toMatchObject({
      needsReconnect: true,
    });
  });

  it("keeps the existing refresh token when Google omits a new one", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, json: async () => ({ access_token: "new-at", expires_in: 3600 }),
    });

    const result = await yt.refreshAccessToken({ refreshToken: "original-rt" });
    expect(result.accessToken).toBe("new-at");
    expect(result.refreshToken).toBe("original-rt");
  });

  it("treats a missing refresh token as needing reconnect", async () => {
    await expect(yt.refreshAccessToken({ refreshToken: null })).rejects.toMatchObject({
      needsReconnect: true,
    });
  });
});

describe("YouTube publish", () => {
  const yt = new YouTubeProvider({ clientId: "id", clientSecret: "secret" });

  it("opens a resumable session, then PUTs the bytes to the returned URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ location: "https://upload.googleapis.com/session/abc" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "vid123", status: { uploadStatus: "uploaded" } }),
      });

    const result = await yt.publish({
      accessToken: "at", videoStream: "stream", sizeBytes: 1000,
      title: "Hello", description: "d", tags: ["a"], privacy: "public",
    });

    expect(fetchSpy.mock.calls[0][0]).toContain("uploadType=resumable");
    expect(fetchSpy.mock.calls[1][0]).toBe("https://upload.googleapis.com/session/abc");
    expect(fetchSpy.mock.calls[1][1].method).toBe("PUT");
    // Uploaded but still transcoding, so not yet watchable.
    expect(result).toEqual({
      externalId: "vid123",
      externalUrl: "https://www.youtube.com/watch?v=vid123",
      status: "PROCESSING",
    });
  });

  it("truncates a title past YouTube's 100-character limit", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ location: "https://u/s" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "v", status: { uploadStatus: "processed" } }) });

    await yt.publish({ accessToken: "at", videoStream: "s", sizeBytes: 10, title: "x".repeat(300) });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.snippet.title).toHaveLength(100);
  });

  it("falls back to private for an unrecognised privacy value", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ location: "https://u/s" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "v", status: {} }) });

    await yt.publish({ accessToken: "at", videoStream: "s", sizeBytes: 10, title: "t", privacy: "everyone" });

    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).status.privacyStatus).toBe("private");
  });

  it("marks a 5xx retryable and a 400 not retryable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false, status: 503, text: async () => "backend error", headers: new Headers(),
    });
    await expect(yt.publish({ accessToken: "at", videoStream: "s", sizeBytes: 1, title: "t" }))
      .rejects.toMatchObject({ retryable: true });

    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false, status: 400, text: async () => "bad title", headers: new Headers(),
    });
    await expect(yt.publish({ accessToken: "at", videoStream: "s", sizeBytes: 1, title: "t" }))
      .rejects.toMatchObject({ retryable: false });
  });

  it("reports PUBLISHED only once YouTube has finished processing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ status: { uploadStatus: "processed" } }] }),
    });

    expect(await yt.checkStatus({ accessToken: "at", externalId: "v1" })).toEqual({
      status: "PUBLISHED", externalUrl: "https://www.youtube.com/watch?v=v1",
    });
  });

  it("reports FAILED for a rejected upload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ status: { uploadStatus: "rejected" } }] }),
    });

    expect((await yt.checkStatus({ accessToken: "at", externalId: "v1" })).status).toBe("FAILED");
  });

  afterEach(() => vi.restoreAllMocks());
});
