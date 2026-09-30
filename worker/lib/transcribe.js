import fs from "node:fs";

/**
 * Speech-to-text with word-level timings.
 *
 * Word timings are non-negotiable: karaoke and word-by-word captions are the
 * feature people pay for, and sentence-level timings cannot produce them.
 *
 * Uses the OpenAI Whisper endpoint by default because it is the cheapest
 * hosted option with word granularity ($0.006/min, ~82% of our per-minute
 * cost). Point WHISPER_BASE_URL at a self-hosted faster-whisper server with the
 * same API shape to cut that ~100x — the planned lever once volume justifies
 * running one (docs/TECH_DEBT.md T4).
 */

const BASE_URL = process.env.WHISPER_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.WHISPER_MODEL || "whisper-1";
const API_KEY = process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY;

/** Languages we expose in the UI; Whisper detects many more. */
export const SUPPORTED_LANGUAGES = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  it: "Italian", pt: "Portuguese", ja: "Japanese", ko: "Korean",
};

/**
 * Whisper reports the detected language as a lowercase English name
 * ("english"), but its `language` request parameter only accepts ISO-639-1
 * codes ("en"). Normalise to the code so it can be passed back in — sending
 * the name returns a 400 on every request after the first.
 */
const LANGUAGE_CODES = {
  afrikaans: "af", arabic: "ar", armenian: "hy", azerbaijani: "az", belarusian: "be",
  bosnian: "bs", bulgarian: "bg", catalan: "ca", chinese: "zh", croatian: "hr",
  czech: "cs", danish: "da", dutch: "nl", english: "en", estonian: "et", finnish: "fi",
  french: "fr", galician: "gl", german: "de", greek: "el", hebrew: "he", hindi: "hi",
  hungarian: "hu", icelandic: "is", indonesian: "id", italian: "it", japanese: "ja",
  kannada: "kn", kazakh: "kk", korean: "ko", latvian: "lv", lithuanian: "lt",
  macedonian: "mk", malay: "ms", marathi: "mr", maori: "mi", nepali: "ne",
  norwegian: "no", persian: "fa", polish: "pl", portuguese: "pt", romanian: "ro",
  russian: "ru", serbian: "sr", slovak: "sk", slovenian: "sl", spanish: "es",
  swahili: "sw", swedish: "sv", tagalog: "tl", tamil: "ta", thai: "th", turkish: "tr",
  ukrainian: "uk", urdu: "ur", vietnamese: "vi", welsh: "cy",
};

export function toLanguageCode(language) {
  if (!language) return null;
  const value = String(language).trim().toLowerCase();
  if (/^[a-z]{2}$/.test(value)) return value;
  return LANGUAGE_CODES[value] ?? null;
}

/**
 * Normalize a Whisper verbose_json response into our word shape.
 *
 * Falls back to distributing time evenly across a segment's words when the
 * provider returns segments without word timings — a degraded caption is far
 * better than a failed job.
 */
export function normalizeWords(payload) {
  if (Array.isArray(payload.words) && payload.words.length > 0) {
    return payload.words
      .map((word) => ({
        w: String(word.word ?? word.text ?? "").trim(),
        start: Number(word.start),
        end: Number(word.end),
      }))
      .filter((word) => word.w && Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start);
  }

  const words = [];
  for (const segment of payload.segments ?? []) {
    const tokens = String(segment.text ?? "").trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;

    const start = Number(segment.start) || 0;
    const end = Number(segment.end) || start + tokens.length * 0.3;
    const step = (end - start) / tokens.length;

    tokens.forEach((token, index) => {
      words.push({ w: token, start: start + index * step, end: start + (index + 1) * step });
    });
  }
  return words;
}

/**
 * Transcribe an audio file.
 *
 * @param {string} audioPath compressed mono audio (see ffmpeg.extractAudioChunk)
 * @param {{language?: string, signal?: AbortSignal}} [options]
 * @returns {Promise<{language:string, text:string, words:Array}>}
 */
export async function transcribe(audioPath, { language, signal } = {}) {
  if (!API_KEY) {
    throw new Error("WHISPER_API_KEY (or OPENAI_API_KEY) is not configured");
  }

  const form = new FormData();
  const buffer = await fs.promises.readFile(audioPath);
  form.append("file", new Blob([buffer], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", MODEL);
  form.append("response_format", "verbose_json");
  // Ask for word granularity explicitly; without it the API returns segments only.
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  if (language) form.append("language", language);

  const response = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
    signal,
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Transcription failed: ${response.status} ${detail.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();

  return {
    // null when the name is one we cannot map; the caller then simply doesn't
    // pin the language for later slices.
    language: toLanguageCode(payload.language) ?? toLanguageCode(language),
    text: payload.text || "",
    words: normalizeWords(payload),
  };
}

/** Whether the API is configured, so the worker can fail early and clearly. */
export function isTranscriptionConfigured() {
  return Boolean(API_KEY);
}

/**
 * Split a duration into fixed-length slices.
 *
 * Fixed-length rather than "only when it's too big": one code path for every
 * video, each request small enough to retry cheaply, and slices can run in
 * parallel. At 10 minutes and 48 kbps a slice is ~3.6 MB, far under the 25 MB
 * cap. A word that straddles a boundary can be split or duplicated; the merge
 * below drops the duplicate, and a split word is a one-frame caption glitch.
 */
export function planChunks(durationSec, chunkSec = 600) {
  const total = Math.max(0, Number(durationSec) || 0);
  if (total === 0) return [{ index: 0, startSec: 0, durationSec: chunkSec }];

  const chunks = [];
  for (let start = 0, index = 0; start < total; start += chunkSec, index++) {
    chunks.push({ index, startSec: start, durationSec: Math.min(chunkSec, total - start) });
  }
  return chunks;
}

/**
 * Combine per-slice results into one transcript on the source timeline.
 *
 * Each slice's timestamps start at 0, so they are shifted by the slice's
 * offset. Words are then sorted and any word overlapping the previous one by
 * more than half its length is dropped, which removes the duplicate a boundary
 * sometimes produces.
 */
export function mergeChunkResults(chunks) {
  const ordered = [...chunks].sort((a, b) => a.startSec - b.startSec);

  const words = [];
  for (const chunk of ordered) {
    for (const word of chunk.result?.words ?? []) {
      words.push({ ...word, start: word.start + chunk.startSec, end: word.end + chunk.startSec });
    }
  }
  words.sort((a, b) => a.start - b.start);

  const deduped = [];
  for (const word of words) {
    const previous = deduped[deduped.length - 1];
    if (previous) {
      const overlap = Math.min(previous.end, word.end) - Math.max(previous.start, word.start);
      const length = word.end - word.start;
      if (overlap > 0 && length > 0 && overlap / length > 0.5 && previous.w === word.w) continue;
    }
    deduped.push(word);
  }

  const text = ordered
    .map((chunk) => (chunk.result?.text ?? "").trim())
    .filter(Boolean)
    .join(" ");

  return {
    language: ordered.find((chunk) => chunk.result?.language)?.result.language ?? "en",
    text,
    words: deduped,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * transcribe(), retried on the failures that are worth retrying: rate limits,
 * server errors, and dropped connections. A 400 or 401 is returned at once —
 * retrying a bad request or a wrong key only delays the error message.
 */
export async function transcribeWithRetry(audioPath, options = {}, { attempts = 4, baseDelayMs = 2000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await transcribe(audioPath, options);
    } catch (error) {
      lastError = error;
      const retryable = !error.status || error.status === 429 || error.status >= 500;
      if (!retryable || attempt === attempts) throw error;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

export { MODEL as WHISPER_MODEL_ID };
