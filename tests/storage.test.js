import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Point local storage at a throwaway folder before the module reads it.
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "clipcore-storage-"));
process.env.LOCAL_STORAGE_DIR = ROOT;
delete process.env.R2_BUCKET;
delete process.env.STORAGE_DRIVER;

let storage;
beforeAll(async () => {
  storage = await import("@/lib/storage");
});
afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }));

describe("driver selection", () => {
  it("defaults to local when no bucket is configured", () => {
    expect(storage.driver).toBe("local");
  });
});

describe("localPath — path traversal", () => {
  // Keys reach /api/media straight from the URL, so these are real inputs.
  it.each([
    ["parent escape", "../../.env"],
    ["nested escape", "clips/../../../etc/passwd"],
    ["absolute path", "/etc/passwd"],
    ["the root itself", "."],
    ["empty", ""],
    ["null byte", "clips/a\0.mp4"],
  ])("refuses %s", (_name, key) => {
    expect(() => storage.localPath(key)).toThrow(/Invalid storage key/);
  });

  it("resolves a normal key inside the root", () => {
    expect(storage.localPath("clips/u/c/r.mp4")).toBe(path.join(ROOT, "clips/u/c/r.mp4"));
  });
});

describe("mediaUrl", () => {
  it("points local objects at /api/media, encoding each segment", async () => {
    expect(await storage.mediaUrl("clips/u 1/c/r.mp4")).toBe("/api/media/clips/u%201/c/r.mp4");
  });

  it("adds a download flag and filename when asked", async () => {
    const url = await storage.mediaUrl("clips/u/c/r.mp4", { download: true, filename: "My clip" });
    expect(url).toBe("/api/media/clips/u/c/r.mp4?download=1&name=My+clip");
  });

  it("returns null for a missing key rather than a broken URL", async () => {
    expect(await storage.mediaUrl(null)).toBeNull();
    expect(await storage.mediaUrl("")).toBeNull();
  });
});

describe("safeFilename", () => {
  it("strips characters that would break a Content-Disposition header", () => {
    expect(storage.safeFilename('my "clip"; x=y\r\n')).toBe("my clip xy");
  });

  it("never returns an empty name", () => {
    expect(storage.safeFilename("")).toBe("clip");
    expect(storage.safeFilename('"";')).toBe("clip");
  });

  it("caps the length", () => {
    expect(storage.safeFilename("a".repeat(500)).length).toBeLessThanOrEqual(120);
  });
});

describe("local read / write / delete", () => {
  it("round-trips an object and reports its size", async () => {
    await storage.putObject("clips/u/c/a.txt", "hello");
    expect(await storage.statObject("clips/u/c/a.txt")).toEqual({ size: 5 });
  });

  it("reads an exact byte range — what <video> seeking relies on", async () => {
    await storage.putObject("clips/u/c/b.txt", "0123456789");
    const chunks = [];
    for await (const chunk of storage.readStream("clips/u/c/b.txt", { start: 2, end: 5 })) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toBe("2345");
  });

  it("returns null for an object that doesn't exist", async () => {
    expect(await storage.statObject("clips/nope/missing.mp4")).toBeNull();
  });

  it("deletes a whole prefix, so deleting a video leaves no orphaned files", async () => {
    await storage.putObject("sources/u/v1/source.mp4", "x");
    await storage.putObject("sources/u/v1/thumb.jpg", "y");
    await storage.deletePrefix("sources/u/v1");
    expect(fs.existsSync(path.join(ROOT, "sources/u/v1"))).toBe(false);
  });
});
