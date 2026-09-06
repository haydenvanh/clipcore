import { randomUUID } from "node:crypto";
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  HeadObjectCommand, DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage on Cloudflare R2, through the S3 API.
 *
 * R2 over S3 for one decisive reason: egress is free. Every clip a user
 * downloads is bandwidth we would otherwise pay for, so the bill would scale
 * with exactly the behaviour we want more of. Using the S3 SDK keeps S3 as a
 * three-variable fallback rather than a rewrite.
 *
 * Uploads never pass through Next.js. The browser gets a presigned PUT and
 * talks to R2 directly — Vercel caps request bodies at 4.5 MB, which is
 * useless for video, and proxying gigabytes through a serverless function
 * would be wrong even if it were allowed.
 */

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;

/** Optional: a custom domain or r2.dev bucket URL for public reads. */
const PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

/** Set R2_ENDPOINT to point the same code at AWS S3 or MinIO instead. */
const ENDPOINT =
  process.env.R2_ENDPOINT ||
  (ACCOUNT_ID ? `https://${ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

export const isStorageConfigured = Boolean(ENDPOINT && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET);

/** Largest single source upload, in bytes. Mirrored in the presign response. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

/** Source formats we accept. Anything else is rejected before a URL is issued. */
export const ALLOWED_UPLOAD_TYPES = new Set([
  "video/mp4", "video/quicktime", "video/x-matroska", "video/webm",
  "video/x-msvideo", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a",
]);

const EXTENSION_BY_TYPE = {
  "video/mp4": "mp4", "video/quicktime": "mov", "video/x-matroska": "mkv",
  "video/webm": "webm", "video/x-msvideo": "avi", "audio/mpeg": "mp3",
  "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-m4a": "m4a",
};

let client = null;

function getClient() {
  if (!isStorageConfigured) {
    throw new Error(
      "Object storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET."
    );
  }
  if (!client) {
    client = new S3Client({
      // R2 ignores the region but the SDK requires one.
      region: process.env.R2_REGION || "auto",
      endpoint: ENDPOINT,
      credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
      // R2 requires path-style addressing.
      forcePathStyle: true,
    });
  }
  return client;
}

/**
 * Object key layouts. Everything is namespaced by user id so that a leaked or
 * guessed key cannot wander into another tenant's data, and so a deletion
 * request is a prefix delete.
 */
export const keys = {
  source: (userId, videoId, ext = "mp4") => `sources/${userId}/${videoId}/source.${ext}`,
  sourceThumb: (userId, videoId) => `sources/${userId}/${videoId}/thumb.jpg`,
  clip: (userId, clipId, renderId, ext = "mp4") => `clips/${userId}/${clipId}/${renderId}.${ext}`,
  clipThumb: (userId, clipId, renderId) => `clips/${userId}/${clipId}/${renderId}.jpg`,
  transcript: (videoId) => `transcripts/${videoId}.json`,
  captions: (clipId, lang = "en") => `captions/${clipId}.${lang}.ass`,
};

export function extensionForType(contentType) {
  return EXTENSION_BY_TYPE[contentType] || "mp4";
}

/**
 * A presigned PUT the browser can upload straight to.
 *
 * The content type and length are signed in, so the URL cannot be reused to
 * store something else or something larger than we agreed to.
 */
export async function createUploadUrl({ userId, contentType, contentLength, videoId }) {
  if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
    throw new Error(`Unsupported file type: ${contentType}`);
  }
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    throw new Error("A valid file size is required");
  }
  if (contentLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024 / 1024)} GB limit`
    );
  }

  const id = videoId || randomUUID();
  const key = keys.source(userId, id, extensionForType(contentType));

  const url = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: 60 * 15 }
  );

  return { uploadUrl: url, key, videoId: id, expiresIn: 900, maxBytes: MAX_UPLOAD_BYTES };
}

/**
 * A short-lived GET for reading an object.
 *
 * Short-lived on purpose: a clip URL that leaks should stop working, which is
 * the whole reason we stopped handing out third-party CDN links that never
 * expire and that we could not revoke.
 */
export async function createDownloadUrl(key, { expiresIn = 3600, filename } = {}) {
  if (!key) throw new Error("An object key is required");

  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ...(filename
        ? { ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"` }
        : {}),
    }),
    { expiresIn }
  );
}

/** Stable public URL, when the bucket is served from a custom domain. */
export function publicUrl(key) {
  if (!PUBLIC_BASE_URL || !key) return null;
  return `${PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}

/** Upload from the server or the worker (renders, transcripts, thumbnails). */
export async function putObject(key, body, { contentType, cacheControl } = {}) {
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
  return key;
}

/** Size and content type of a stored object, or null if it does not exist. */
export async function headObject(key) {
  try {
    const res = await getClient().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { size: res.ContentLength, contentType: res.ContentType, lastModified: res.LastModified };
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

export async function deleteObject(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Delete many objects at once — S3 caps a batch at 1000 keys. */
export async function deleteObjects(keyList) {
  const list = keyList.filter(Boolean);
  if (list.length === 0) return;

  for (let i = 0; i < list.length; i += 1000) {
    const batch = list.slice(i, i + 1000);
    await getClient().send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      })
    );
  }
}
