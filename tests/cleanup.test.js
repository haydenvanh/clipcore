import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let root;
let cleanup;

beforeAll(async () => {
  // storage.js reads its root at import time, so point it at a temp dir first.
  root = fs.mkdtempSync(path.join(os.tmpdir(), "clipcore-cleanup-"));
  process.env.LOCAL_STORAGE_DIR = root;
  cleanup = await import("../worker/lib/cleanup.js");
});

afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

function writeSource(key) {
  const file = path.join(root, key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "video");
  return file;
}

/** Just enough Prisma for the cleanup module. */
function fakePrisma(videos) {
  return {
    videos,
    video: {
      findUnique: async ({ where }) => videos.find((v) => v.id === where.id) ?? null,
      findMany: async ({ where }) =>
        videos.filter(
          (v) => v.storageKey && !v.sourceDeletedAt && where.status.in.includes(v.status) && v.updatedAt < where.updatedAt.lt
        ),
      update: async ({ where, data }) => Object.assign(videos.find((v) => v.id === where.id), data),
    },
  };
}

const video = (id, statuses, extra = {}) => ({
  id,
  storageKey: `sources/u1/${id}/source.mp4`,
  sourceDeletedAt: null,
  status: "COMPLETED",
  updatedAt: new Date(),
  clips: [{ renders: statuses.map((status) => ({ status })) }],
  ...extra,
});

describe("deleteSourceIfDone", () => {
  it("deletes the original once every clip has rendered", async () => {
    const file = writeSource("sources/u1/v1/source.mp4");
    const prisma = fakePrisma([video("v1", ["COMPLETED", "COMPLETED"])]);
    expect(await cleanup.deleteSourceIfDone(prisma, "v1")).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
    expect(prisma.videos[0].sourceDeletedAt).toBeInstanceOf(Date);
  });

  it("keeps the original while a failed clip might be retried", async () => {
    const file = writeSource("sources/u1/v2/source.mp4");
    const prisma = fakePrisma([video("v2", ["COMPLETED", "FAILED"])]);
    expect(await cleanup.deleteSourceIfDone(prisma, "v2")).toBe(false);
    expect(fs.existsSync(file)).toBe(true);
  });

  it("does nothing the second time", async () => {
    const prisma = fakePrisma([video("v3", ["COMPLETED"], { sourceDeletedAt: new Date() })]);
    expect(await cleanup.deleteSourceIfDone(prisma, "v3")).toBe(false);
  });
});

describe("sweepOldSources", () => {
  it("deletes originals older than the retry window, and only those", async () => {
    const old = new Date(Date.now() - (cleanup.RETRY_WINDOW_DAYS + 1) * 86_400_000);
    const oldFile = writeSource("sources/u1/old/source.mp4");
    const newFile = writeSource("sources/u1/new/source.mp4");
    const busyFile = writeSource("sources/u1/busy/source.mp4");
    const prisma = fakePrisma([
      video("old", ["FAILED"], { status: "FAILED", updatedAt: old }),
      video("new", ["FAILED"], { status: "FAILED" }),
      video("busy", [], { status: "RENDERING", updatedAt: old }),
    ]);
    expect(await cleanup.sweepOldSources(prisma)).toBe(1);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
    expect(fs.existsSync(busyFile)).toBe(true);
  });
});
