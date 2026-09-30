import fs from "node:fs";

/**
 * Locate ffmpeg and ffprobe.
 *
 * Prefers Homebrew's `ffmpeg-full`, which is keg-only — installed alongside the
 * plain `ffmpeg` rather than on PATH — because it is the prebuilt Homebrew
 * ffmpeg that includes libass, and without libass captions can't be burned in.
 * The plain formula no longer ships it.
 *
 * Order: explicit env var, then ffmpeg-full (Apple Silicon, then Intel), then
 * whatever is on PATH.
 */
const KEG_DIRS = ["/opt/homebrew/opt/ffmpeg-full/bin", "/usr/local/opt/ffmpeg-full/bin"];

function resolve(name, envVar) {
  if (process.env[envVar]) return process.env[envVar];
  for (const dir of KEG_DIRS) {
    const candidate = `${dir}/${name}`;
    if (fs.existsSync(candidate)) return candidate;
  }
  return name;
}

export const FFMPEG = resolve("ffmpeg", "FFMPEG_PATH");
export const FFPROBE = resolve("ffprobe", "FFPROBE_PATH");
export const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
