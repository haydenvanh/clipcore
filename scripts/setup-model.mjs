#!/usr/bin/env node
/**
 * Download the speech model for local transcription (~550 MB, once).
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
import { LOCAL_MODEL_PATH, LOCAL_MODEL_URL } from "../worker/lib/transcribe-local.js";

const mb = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;

if (fs.existsSync(LOCAL_MODEL_PATH)) {
  console.log(`Already downloaded: ${LOCAL_MODEL_PATH} (${mb(fs.statSync(LOCAL_MODEL_PATH).size)})`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(LOCAL_MODEL_PATH), { recursive: true });
const partPath = `${LOCAL_MODEL_PATH}.part`;

console.log(`Downloading ${path.basename(LOCAL_MODEL_PATH)}…`);
const response = await fetch(LOCAL_MODEL_URL);
if (!response.ok || !response.body) {
  console.error(`Download failed: HTTP ${response.status}`);
  process.exit(1);
}

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

await pipeline(body, fs.createWriteStream(partPath));
fs.renameSync(partPath, LOCAL_MODEL_PATH);
console.log(`\r  ${mb(received)} — done.                    \nSaved to ${LOCAL_MODEL_PATH}`);
