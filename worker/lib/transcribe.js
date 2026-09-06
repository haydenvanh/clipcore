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
 * @param {string} audioPath 16 kHz mono WAV (see ffmpeg.extractAudio)
 * @param {{language?: string, signal?: AbortSignal}} [options]
 * @returns {Promise<{language:string, text:string, words:Array}>}
 */
export async function transcribe(audioPath, { language, signal } = {}) {
  if (!API_KEY) {
    throw new Error("WHISPER_API_KEY (or OPENAI_API_KEY) is not configured");
  }

  const form = new FormData();
  const buffer = await fs.promises.readFile(audioPath);
  form.append("file", new Blob([buffer]), "audio.wav");
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
    throw new Error(`Transcription failed: ${response.status} ${detail.slice(0, 500)}`);
  }

  const payload = await response.json();

  return {
    language: payload.language || language || "en",
    text: payload.text || "",
    words: normalizeWords(payload),
  };
}

export { MODEL as WHISPER_MODEL_ID };
