import fs from "node:fs";
import path from "node:path";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage, as seen by the web app.
 *
 * Mirrors worker/lib/storage.js: the same two drivers, chosen the same way, over
 * the same key layout, so whatever the worker writes the app can read.
 *
 * `local` (the default) keeps everything in a folder on disk and serves it back
 * through /api/media. For a private tool running on one machine this is the
 * whole story — no bucket, no account, no signed URLs.
 *
 * `r2` is kept for running the worker somewhere other than this machine.
 */

const LOCAL_ROOT = path.resolve(process.env.LOCAL_STORAGE_DIR || ".storage");

const hasR2 =
  Boolean(process.env.R2_BUCKET) &&
  Boolean(process.env.R2_ACCESS_KEY_ID) &&
  Boolean(process.env.R2_SECRET_ACCESS_KEY) &&
  Boolean(process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT);

export const driver = process.env.STORAGE_DRIVER || (hasR2 ? "r2" : "local");

/** Upload formats accepted from the browser. */
export const ALLOWED_UPLOAD_TYPES = new Set([
  "video/mp4", "video/quicktime", "video/x-matroska", "video/webm",
  "video/x-msvideo", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a",
]);

const EXTENSION_BY_TYPE = {
  "video/mp4": "mp4", "video/quicktime": "mov", "video/x-matroska": "mkv",
  "video/webm": "webm", "video/x-msvideo": "avi", "audio/mpeg": "mp3",
  "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-m4a": "m4a",
};

export const CONTENT_TYPE_BY_EXTENSION = {
  mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska", webm: "video/webm",
  avi: "video/x-msvideo", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  json: "application/json", ass: "text/plain; charset=utf-8",
  srt: "application/x-subrip; charset=utf-8", vtt: "text/vtt; charset=utf-8",
};

export function extensionForType(contentType) {
  return EXTENSION_BY_TYPE[contentType] || "mp4";
}

/** Same layout as the worker's. Everything is namespaced by owner id. */
export const keys = {
  source: (userId, videoId, ext = "mp4") => `sources/${userId}/${videoId}/source.${ext}`,
  upload: (userId, videoId, ext = "mp4") => `sources/${userId}/${videoId}/upload.${ext}`,
  sourceThumb: (userId, videoId) => `sources/${userId}/${videoId}/thumb.jpg`,
  clip: (userId, clipId, renderId, ext = "mp4") => `clips/${userId}/${clipId}/${renderId}.${ext}`,
  clipThumb: (userId, clipId, renderId) => `clips/${userId}/${clipId}/${renderId}.jpg`,
};

// ─── Local driver ────────────────────────────────────────────────────────────

/**
 * Resolve a key to a path, refusing anything that would escape the storage
 * root. Keys reach the media route from a URL, so "../../.env" is a real input
 * this has to reject.
 */
export function localPath(key) {
  if (typeof key !== "string" || key.length === 0 || key.includes("\0")) {
    throw new Error("Invalid storage key");
  }
  const resolved = path.resolve(LOCAL_ROOT, key);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

/** Size of a stored object, or null if it does not exist. */
export async function statObject(key) {
  if (driver !== "local") throw new Error("statObject is only available for local storage");
  try {
    const { size } = await fs.promises.stat(localPath(key));
    return { size };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

/** Open a read stream over [start, end] of a local object. */
export function readStream(key, { start, end } = {}) {
  if (driver !== "local") throw new Error("readStream is only available for local storage");
  return fs.createReadStream(localPath(key), { start, end });
}

/**
 * Write a web ReadableStream (a request body) to a local object.
 * Streams to disk rather than buffering, so a 2 GB upload does not need 2 GB of
 * memory.
 */
export async function writeStream(key, webStream) {
  const target = localPath(key);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });

  const { Readable } = await import("node:stream");
  const { pipeline } = await import("node:stream/promises");
  await pipeline(Readable.fromWeb(webStream), fs.createWriteStream(target));

  const { size } = await fs.promises.stat(target);
  return { key, size };
}

export async function deleteObject(key) {
  if (driver === "local") {
    await fs.promises.rm(localPath(key), { force: true });
    return;
  }
  await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}

// ─── R2 driver ───────────────────────────────────────────────────────────────

let client = null;
function r2() {
  if (!client) {
    client = new S3Client({
      region: process.env.R2_REGION || "auto",
      endpoint:
        process.env.R2_ENDPOINT ||
        `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }
  return client;
}

export async function putObject(key, body, contentType) {
  if (driver === "local") {
    const target = localPath(key);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, body);
    return key;
  }
  await r2().send(
    new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: body, ContentType: contentType })
  );
  return key;
}

// ─── URLs ────────────────────────────────────────────────────────────────────

/**
 * A URL the browser can load for an object.
 *
 * Local objects are served by /api/media; R2 objects get a short-lived signed
 * URL. `download` sets Content-Disposition so the browser saves rather than
 * plays, under a readable filename.
 */
export async function mediaUrl(key, { download = false, filename } = {}) {
  if (!key) return null;

  if (driver === "local") {
    const params = new URLSearchParams();
    if (download) params.set("download", "1");
    if (filename) params.set("name", filename);
    const query = params.toString();
    return `/api/media/${key.split("/").map(encodeURIComponent).join("/")}${query ? `?${query}` : ""}`;
  }

  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ...(download && filename
        ? { ResponseContentDisposition: `attachment; filename="${safeFilename(filename)}"` }
        : {}),
    }),
    { expiresIn: 3600 }
  );
}

/** Strip anything that would break a Content-Disposition header. */
export function safeFilename(name) {
  return String(name || "clip")
    .replace(/[^\w\-. ]+/g, "")
    .trim()
    .slice(0, 120) || "clip";
}

/**
 * Remove every object under a folder-like prefix.
 * Local only: deleting a video should not leave gigabytes of orphaned media.
 */
export async function deletePrefix(prefix) {
  if (driver !== "local") return;
  const target = localPath(prefix.replace(/\/+$/, ""));
  await fs.promises.rm(target, { recursive: true, force: true });
}
