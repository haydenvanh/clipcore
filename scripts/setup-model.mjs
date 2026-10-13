#!/usr/bin/env node
/**
 * Download the models for local transcription, once: the speech model
 * (~550 MB) and the voice-activity detector (~1 MB).
 *
 *   npm run setup:model
 *
 * Downloads to a .part file and renames it on success, so an interrupted
 * download never leaves a truncated model that whisper.cpp would choke on.
 */
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { LOCAL_MODEL_PATH, LOCAL_MODEL_URL, VAD_MODEL_PATH, VAD_MODEL_URL } from "../worker/lib/transcribe-local.js";

const mb = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;

async function download(url, target) {
  if (fs.existsSync(target)) {
    console.log(`Already downloaded: ${path.basename(target)} (${mb(fs.statSync(target).size)})`);
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const partPath = `${target}.part`;

  console.log(`Downloading ${path.basename(target)}…`);
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);

  const total = Number(response.headers.get("content-length")) || 0;
  let received = 0;
  let lastPrint = 0;
  const body = Readable.fromWeb(response.body);
  body.on("data", (chunk) => {
    received += chunk.length;
    if (Date.now() - lastPrint > 500) {
      lastPrint = Date.now();
      const pct = total ? ` (${Math.floor((received / total) * 100)}%)` : "";
      process.stdout.write(`\r  ${mb(received)}${total ? ` of ${mb(total)}` : ""}${pct}   `);
    }
  });

  try {
    await pipeline(body, fs.createWriteStream(partPath));
  } catch (error) {
    // Don't leave a partial file taking up the space the next attempt needs.
    fs.rmSync(partPath, { force: true });
    throw error;
  }
  fs.renameSync(partPath, target);
  console.log(`\r  ${mb(received)} — done.                    `);
}

try {
  await download(LOCAL_MODEL_URL, LOCAL_MODEL_PATH);
  await download(VAD_MODEL_URL, VAD_MODEL_PATH);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
