import { spawn } from "node:child_process";

/**
 * ffmpeg / ffprobe wrappers.
 *
 * spawn with an argument array, never a shell string: a video title can contain
 * quotes, semicolons and backticks, and building a command string out of user
 * input is a command-injection bug waiting to happen.
 */

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

/**
 * Run a binary and collect its output.
 *
 * @returns {Promise<{stdout:string, stderr:string}>}
 */
export function run(command, args, { timeoutMs = 60 * 60 * 1000, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      // ffmpeg is chatty; keep only a bounded tail so a long encode cannot
      // grow the worker's heap without limit.
      if (stdout.length > 1_000_000) stdout = stdout.slice(-500_000);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (stderr.length > 1_000_000) stderr = stderr.slice(-500_000);
      if (onProgress) onProgress(text);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        reject(new Error(`${command} is not installed or not on PATH`));
      } else {
        reject(error);
      }
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        // The last lines of stderr are where ffmpeg says what went wrong.
        reject(new Error(`${command} exited ${code}: ${stderr.slice(-1500)}`));
      }
    });
  });
}

/** Container and stream metadata for a media file. */
export async function probe(filePath) {
  const { stdout } = await run(
    FFPROBE,
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
    { timeoutMs: 120_000 }
  );

  const data = JSON.parse(stdout);
  const video = data.streams?.find((s) => s.codec_type === "video");
  const audio = data.streams?.find((s) => s.codec_type === "audio");

  return {
    durationSec: Number(data.format?.duration) || 0,
    sizeBytes: Number(data.format?.size) || 0,
    width: video ? Number(video.width) : null,
    height: video ? Number(video.height) : null,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
  };
}

/**
 * Download a source video.
 *
 * `url` has already been through assertSafeUrl on the API side; yt-dlp is given
 * `--` so a URL beginning with a dash cannot be read as a flag.
 */
export async function downloadSource(url, outputPath, { maxHeight = 1080 } = {}) {
  await run(
    YTDLP,
    [
      "-f", `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best`,
      "--merge-output-format", "mp4",
      "--no-playlist",
      "--no-warnings",
      "--socket-timeout", "30",
      "--retries", "3",
      "-o", outputPath,
      "--",
      url,
    ],
    { timeoutMs: 45 * 60 * 1000 }
  );

  return outputPath;
}

/**
 * Re-encode to a predictable intermediate.
 *
 * Sources arrive in every codec and frame rate imaginable; normalizing once
 * means every later step (seek accuracy, cropping, caption burn-in) behaves the
 * same regardless of what the user uploaded.
 */
export async function normalize(inputPath, outputPath) {
  await run(FFMPEG, [
    "-y", "-i", inputPath,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    // yuv420p + even dimensions: some encoders emit odd sizes that H.264
    // players refuse.
    "-pix_fmt", "yuv420p",
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
    "-movflags", "+faststart",
    outputPath,
  ]);
  return outputPath;
}

/** Extract a mono 16 kHz WAV — what speech recognition wants. */
export async function extractAudio(inputPath, outputPath) {
  await run(FFMPEG, [
    "-y", "-i", inputPath,
    "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
    outputPath,
  ]);
  return outputPath;
}

/** A single frame, for a thumbnail. */
export async function thumbnail(inputPath, outputPath, { atSeconds = 1 } = {}) {
  await run(FFMPEG, [
    "-y", "-ss", String(atSeconds), "-i", inputPath,
    "-frames:v", "1", "-q:v", "3",
    outputPath,
  ]);
  return outputPath;
}

export const TARGET_SIZES = {
  RATIO_9_16: { width: 1080, height: 1920 },
  RATIO_1_1: { width: 1080, height: 1080 },
  RATIO_16_9: { width: 1920, height: 1080 },
};

/**
 * Crop-and-scale filter for a target aspect ratio.
 *
 * Scales so the shorter side covers the frame, then centre-crops the excess —
 * so a 16:9 source becomes a full-bleed 9:16 clip with no letterbox bars.
 * Letterboxing is what makes an auto-generated clip look auto-generated.
 */
export function reframeFilter(aspectRatio) {
  const { width, height } = TARGET_SIZES[aspectRatio] ?? TARGET_SIZES.RATIO_9_16;
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    "setsar=1",
  ].join(",");
}

/**
 * Cut one clip, reframe it, and burn in captions.
 *
 * `-ss` before `-i` seeks by keyframe (fast but imprecise); after `-i` it
 * decodes to the exact frame. We put it after so a clip starts on the word the
 * transcript promised, and accept the extra decode time.
 */
export async function renderClip({
  inputPath, outputPath, startSec, endSec, aspectRatio = "RATIO_9_16", subtitlePath,
}) {
  const filters = [reframeFilter(aspectRatio)];

  if (subtitlePath) {
    // The filter argument is itself a mini-language: ':' separates options and
    // '\' escapes, so a path containing either must be escaped or the filter
    // graph fails to parse.
    const escaped = subtitlePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
    filters.push(`subtitles='${escaped}'`);
  }

  await run(FFMPEG, [
    "-y",
    "-i", inputPath,
    "-ss", String(startSec),
    "-to", String(endSec),
    "-vf", filters.join(","),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    outputPath,
  ]);

  return outputPath;
}

export { FFMPEG, FFPROBE, YTDLP };
