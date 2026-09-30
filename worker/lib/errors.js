/**
 * An error that retrying cannot fix.
 *
 * The worker retries failed jobs with backoff (30s, 2m, 10m), which is right
 * for a dropped connection or a rate limit and wrong for a missing API key, a
 * private video, or a video with no speech — those would just fail three times
 * over several minutes before the UI showed the reason. Throwing this instead
 * fails the job at once, with its message shown as-is.
 */
export class PermanentError extends Error {
  constructor(message) {
    super(message);
    this.name = "PermanentError";
    this.permanent = true;
  }
}

/**
 * yt-dlp failures that mean the video itself is unobtainable, mapped to a
 * message worth reading. Anything unrecognised stays retryable.
 */
const YTDLP_PERMANENT = [
  [/private video/i, "This video is private."],
  [/video unavailable|this video is unavailable|has been removed/i, "This video is unavailable or has been removed."],
  [/sign in to confirm your age|age-restricted/i, "This video is age-restricted and can't be downloaded without signing in."],
  [/members-only|join this channel/i, "This video is members-only."],
  [/is not a valid url|unsupported url/i, "That link isn't a video yt-dlp can download."],
  [/premieres in|live event will begin/i, "This video hasn't premiered yet."],
];

export function classifyDownloadError(error) {
  const text = String(error?.message ?? error);
  for (const [pattern, message] of YTDLP_PERMANENT) {
    if (pattern.test(text)) return new PermanentError(message);
  }
  return error;
}
