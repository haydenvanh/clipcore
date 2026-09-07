import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * Worker-side object storage, with two drivers.
 *
 * `local` writes to a folder on disk. It exists so the pipeline can be run and
 * verified end to end without signing up for Cloudflare first — storage is the
 * least interesting part of the pipeline and the most annoying to gate a first
 * test behind. It is for development only; nothing about it is durable or
 * shared between machines.
 *
 * `r2` is the real driver: Cloudflare R2 through the S3 API, chosen because
 * egress is free (see docs/02-ROADMAP.md D5).
 *
 * The driver is picked from the environment, so no call site knows which is in
 * use.
 */

const LOCAL_ROOT = path.resolve(process.env.LOCAL_STORAGE_DIR || ".storage");

const hasR2 =
  Boolean(process.env.R2_BUCKET) &&
  Boolean(process.env.R2_ACCESS_KEY_ID) &&
  Boolean(process.env.R2_SECRET_ACCESS_KEY) &&
  Boolean(process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT);

export const driver = process.env.STORAGE_DRIVER || (hasR2 ? "r2" : "local");

// ─── Local driver ────────────────────────────────────────────────────────────

/** Refuse a key that would escape the storage root. */
function localPath(key) {
  const resolved = path.resolve(LOCAL_ROOT, key);
  if (resolved !== LOCAL_ROOT && !resolved.startsWith(LOCAL_ROOT + path.sep)) {
    throw new Error(`Refusing to write outside the storage root: ${key}`);
  }
  return resolved;
}

const localDriver = {
  async download(key, destPath) {
    const source = localPath(key);
    if (!fs.existsSync(source)) throw new Error(`Object not found: ${key}`);
    await fs.promises.copyFile(source, destPath);
    return destPath;
  },

  async upload(localFile, key) {
    const target = localPath(key);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.copyFile(localFile, target);
    const { size } = await fs.promises.stat(target);
    return { key, size };
  },

  async uploadText(text, key) {
    const target = localPath(key);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, text, "utf8");
    return key;
  },
};

// ─── R2 driver ───────────────────────────────────────────────────────────────

let client = null;
function getClient() {
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

const r2Driver = {
  async download(key, destPath) {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key })
    );
    await pipeline(res.Body, fs.createWriteStream(destPath));
    return destPath;
  },

  async upload(localFile, key, contentType) {
    const stat = await fs.promises.stat(localFile);
    await getClient().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: fs.createReadStream(localFile),
        ContentType: contentType,
        ContentLength: stat.size,
      })
    );
    return { key, size: stat.size };
  },

  async uploadText(text, key, contentType = "text/plain") {
    await getClient().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: text,
        ContentType: contentType,
      })
    );
    return key;
  },
};

const active = driver === "local" ? localDriver : r2Driver;

export const download = (...args) => active.download(...args);
export const upload = (...args) => active.upload(...args);
export const uploadText = (...args) => active.uploadText(...args);

export const keys = {
  source: (userId, videoId, ext = "mp4") => `sources/${userId}/${videoId}/source.${ext}`,
  sourceThumb: (userId, videoId) => `sources/${userId}/${videoId}/thumb.jpg`,
  clip: (userId, clipId, renderId, ext = "mp4") => `clips/${userId}/${clipId}/${renderId}.${ext}`,
  clipThumb: (userId, clipId, renderId) => `clips/${userId}/${clipId}/${renderId}.jpg`,
  transcript: (videoId) => `transcripts/${videoId}.json`,
  captions: (clipId, lang = "en") => `captions/${clipId}.${lang}.ass`,
};
