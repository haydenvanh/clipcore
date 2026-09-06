import { describe, it, expect, beforeAll } from "vitest";

// Credentials must exist before the module reads them at import time.
process.env.R2_ACCOUNT_ID = "acct123";
process.env.R2_ACCESS_KEY_ID = "ak_test";
process.env.R2_SECRET_ACCESS_KEY = "sk_test";
process.env.R2_BUCKET = "clipcore-test";

let storage;
beforeAll(async () => {
  storage = await import("@/lib/storage");
});

describe("object key layout", () => {
  it("namespaces every key by user id, so a guessed key stays in its own tenant", () => {
    const { keys } = storage;
    expect(keys.source("u1", "v1")).toBe("sources/u1/v1/source.mp4");
    expect(keys.source("u1", "v1", "mov")).toBe("sources/u1/v1/source.mov");
    expect(keys.clip("u1", "c1", "r1")).toBe("clips/u1/c1/r1.mp4");
    expect(keys.clipThumb("u1", "c1", "r1")).toBe("clips/u1/c1/r1.jpg");
    expect(keys.transcript("v1")).toBe("transcripts/v1.json");
    expect(keys.captions("c1", "es")).toBe("captions/c1.es.ass");
  });

  it("maps content types to sane extensions and falls back safely", () => {
    expect(storage.extensionForType("video/quicktime")).toBe("mov");
    expect(storage.extensionForType("audio/mpeg")).toBe("mp3");
    expect(storage.extensionForType("application/x-evil")).toBe("mp4");
  });
});

describe("createUploadUrl", () => {
  it("signs a PUT that carries the key, the type, and an expiry", async () => {
    const res = await storage.createUploadUrl({
      userId: "u1", videoId: "v1", contentType: "video/mp4", contentLength: 5_000_000,
    });
    expect(res.key).toBe("sources/u1/v1/source.mp4");
    expect(res.uploadUrl).toContain("clipcore-test");
    expect(res.uploadUrl).toContain("X-Amz-Signature");
    expect(res.expiresIn).toBe(900);
  });

  it("refuses a file type that is not on the allowlist", async () => {
    await expect(
      storage.createUploadUrl({ userId: "u1", contentType: "application/zip", contentLength: 100 })
    ).rejects.toThrow(/Unsupported file type/);
  });

  it("refuses anything over the 2 GB cap before a URL exists", async () => {
    await expect(
      storage.createUploadUrl({
        userId: "u1", contentType: "video/mp4", contentLength: 3 * 1024 * 1024 * 1024,
      })
    ).rejects.toThrow(/larger than/);
  });

  it("refuses a missing or nonsensical size", async () => {
    for (const contentLength of [0, -1, NaN, undefined]) {
      await expect(
        storage.createUploadUrl({ userId: "u1", contentType: "video/mp4", contentLength })
      ).rejects.toThrow(/valid file size/);
    }
  });

  it("generates a video id when one is not supplied", async () => {
    const res = await storage.createUploadUrl({
      userId: "u1", contentType: "video/mp4", contentLength: 1000,
    });
    expect(res.videoId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.key).toContain(res.videoId);
  });
});

describe("createDownloadUrl", () => {
  it("signs a time-limited GET", async () => {
    const url = await storage.createDownloadUrl("clips/u1/c1/r1.mp4", { expiresIn: 60 });
    expect(url).toContain("X-Amz-Signature");
    expect(url).toContain("X-Amz-Expires=60");
  });

  it("sets a download filename without letting a quote break the header", async () => {
    const url = await storage.createDownloadUrl("clips/u1/c1/r1.mp4", {
      filename: 'my"clip.mp4',
    });
    const disposition = decodeURIComponent(url).match(/response-content-disposition=([^&]+)/i);
    expect(disposition).toBeTruthy();
    expect(decodeURIComponent(disposition[1])).toBe('attachment; filename="myclip.mp4"');
  });

  it("requires a key", async () => {
    await expect(storage.createDownloadUrl("")).rejects.toThrow(/key is required/);
  });
});
