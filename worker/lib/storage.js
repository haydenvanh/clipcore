import fs from "node:fs";
import {
  S3Client, PutObjectCommand, GetObjectCommand,
} from "@aws-sdk/client-s3";
import { pipeline } from "node:stream/promises";

/**
 * Worker-side object storage.
 *
 * Mirrors src/lib/storage.js (same bucket, same key layout) but streams to and
 * from disk instead of presigning, because the worker handles the bytes itself.
 */

const ENDPOINT =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);
const BUCKET = process.env.R2_BUCKET;

const client = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

/** Stream an object down to a local path. */
export async function download(key, destPath) {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  await pipeline(res.Body, fs.createWriteStream(destPath));
  return destPath;
}

/** Stream a local file up. */
export async function upload(localPath, key, contentType) {
  const stat = await fs.promises.stat(localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fs.createReadStream(localPath),
      ContentType: contentType,
      ContentLength: stat.size,
    })
  );
  return { key, size: stat.size };
}

/** Upload an in-memory string (transcripts, caption files). */
export async function uploadText(text, key, contentType = "text/plain") {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: text, ContentType: contentType })
  );
  return key;
}

export const keys = {
  source: (userId, videoId, ext = "mp4") => `sources/${userId}/${videoId}/source.${ext}`,
  sourceThumb: (userId, videoId) => `sources/${userId}/${videoId}/thumb.jpg`,
  clip: (userId, clipId, renderId, ext = "mp4") => `clips/${userId}/${clipId}/${renderId}.${ext}`,
  clipThumb: (userId, clipId, renderId) => `clips/${userId}/${clipId}/${renderId}.jpg`,
  transcript: (videoId) => `transcripts/${videoId}.json`,
  captions: (clipId, lang = "en") => `captions/${clipId}.${lang}.ass`,
};
