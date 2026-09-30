import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./ffmpeg.js";
import { PermanentError } from "./errors.js";

/**
 * Speech-to-text on this machine with whisper.cpp — no API key, no cost.
 *
 * Used whenever no OpenAI key is configured. whisper.cpp runs the Whisper
 * large-v3-turbo model on the GPU (Metal on Apple Silicon), which transcribes
 * an hour of speech in a few minutes. Word timings come from `--max-len 1
 * --split-on-word`, which makes every output segment a single word.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const LOCAL_MODEL_FILE = "ggml-large-v3-turbo-q5_0.bin";
export const LOCAL_MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${LOCAL_MODEL_FILE}`;
export const LOCAL_MODEL_PATH = path.resolve(REPO_ROOT, process.env.WHISPER_CPP_MODEL || path.join("models", LOCAL_MODEL_FILE));
export const LOCAL_MODEL_NAME = `whisper.cpp:${path.basename(LOCAL_MODEL_PATH, ".bin").replace(/^ggml-/, "")}`;

const CLI_CANDIDATES = ["/opt/homebrew/bin/whisper-cli", "/usr/local/bin/whisper-cli"];
export const WHISPER_CLI =
  process.env.WHISPER_CPP_PATH || CLI_CANDIDATES.find((p) => fs.existsSync(p)) || "whisper-cli";

/**
 * A short, properly punctuated line in each language, given to the decoder as
 * a prompt on every 30-second window.
 *
 * Without it, whisper.cpp can slip into all-lowercase, unpunctuated text
 * partway through a long recording and stay there for the rest of it, because
 * each window is conditioned on the one before. On a real 2h47m podcast that
 * was the first 140 minutes. Sentence boundaries drive both clip selection and
 * captions, so this matters.
 */
const LANGUAGE_PROMPTS = {
  en: "Hello, and welcome back to the show. How are you doing? I'm great, thanks!",
  es: "Hola, y bienvenidos de nuevo al programa. ¿Cómo estás? ¡Muy bien, gracias!",
  fr: "Bonjour, et bienvenue dans l'émission. Comment allez-vous ? Très bien, merci !",
  de: "Hallo und willkommen zurück in der Sendung. Wie geht es dir? Sehr gut, danke!",
  it: "Ciao, e bentornati nel programma. Come stai? Benissimo, grazie!",
  pt: "Olá, e bem-vindos de volta ao programa. Como você está? Muito bem, obrigado!",
  ja: "こんにちは、番組へようこそ。お元気ですか？はい、元気です！",
  ko: "안녕하세요, 방송에 다시 오신 것을 환영합니다. 잘 지내셨어요? 네, 잘 지냈어요!",
};

/** A word this short was squashed by the aligner rather than spoken that fast. */
const SQUASHED_SEC = 0.08;
/** Rough speaking time for a word, used to un-squash one. */
const estimate = (word) => Math.max(0.18, String(word.w).length * 0.07);

/**
 * Why local transcription can't run, or null when it can.
 * Checked before a job starts so the failure names the fix.
 */
export function localTranscriptionProblem() {
  if (!fs.existsSync(LOCAL_MODEL_PATH)) {
    return `The speech model isn't downloaded (${path.relative(REPO_ROOT, LOCAL_MODEL_PATH)}). Run: npm run setup:model — then press Retry.`;
  }
  if (WHISPER_CLI === "whisper-cli" && !isOnPath("whisper-cli")) {
    return "whisper.cpp isn't installed. Run: brew install whisper-cpp — then restart and press Retry.";
  }
  return null;
}

function isOnPath(binary) {
  return (process.env.PATH || "")
    .split(path.delimiter)
    .some((dir) => dir && fs.existsSync(path.join(dir, binary)));
}

/**
 * Spread out runs of words the aligner squashed into a few milliseconds.
 *
 * whisper.cpp sometimes stacks the first words after a pause onto one instant
 * ("And that's pretty" all at 16.00s). Burned in as karaoke captions they'd
 * flash by unreadably, so each run — plus the normal word after it — is
 * re-spread over a plausible span, borrowing time from the silence before it
 * but never overlapping the previous word.
 */
export function repairSquashedWords(words) {
  const out = words.map((w) => ({ ...w }));

  for (let i = 0; i < out.length; i++) {
    if (out[i].end - out[i].start >= SQUASHED_SEC) continue;

    let last = i;
    while (last + 1 < out.length && out[last + 1].end - out[last + 1].start < SQUASHED_SEC) last++;
    if (last + 1 < out.length) last++; // include the first normal word as an anchor

    const group = out.slice(i, last + 1);
    const weights = group.map(estimate);
    const needed = weights.reduce((a, b) => a + b, 0);

    const floor = i > 0 ? out[i - 1].end : 0;
    const end = Math.max(group[group.length - 1].end, group[0].start + 0.05);
    const start = end - group[0].start >= needed ? group[0].start : Math.max(floor, end - needed);

    const span = end - start;
    let cursor = start;
    group.forEach((word, k) => {
      word.start = round(cursor);
      cursor += (span * weights[k]) / needed;
      word.end = round(k === group.length - 1 ? end : cursor);
    });

    i = last;
  }

  return out.filter((w) => w.end > w.start);
}

const round = (n) => Math.round(n * 1000) / 1000;

/** Turn whisper.cpp's `--output-json` into our transcript shape. */
export function parseWhisperCppJson(payload) {
  const words = [];
  for (const segment of payload?.transcription ?? []) {
    const text = String(segment.text ?? "").trim();
    // Special tokens ("[_BEG_]", "[BLANK_AUDIO]") are not speech.
    if (!text || /^\[.*\]$/.test(text)) continue;

    const start = Number(segment.offsets?.from) / 1000;
    const end = Number(segment.offsets?.to) / 1000;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    // --split-on-word yields one word per segment; split defensively anyway.
    const parts = text.split(/\s+/);
    const step = Math.max(0, end - start) / parts.length;
    parts.forEach((part, k) => {
      words.push({ w: part, start: start + k * step, end: start + (k + 1) * step });
    });
  }

  const repaired = repairSquashedWords(words);
  return {
    language: payload?.result?.language || "en",
    text: repaired.map((w) => w.w).join(" "),
    words: repaired,
  };
}

/** Read the language whisper.cpp reports on stderr, e.g. "auto-detected language: en (p = 0.99)". */
export function parseDetectedLanguage(stderr) {
  return /auto-detected language:\s*([a-z]{2,3})\b/.exec(String(stderr))?.[1] ?? null;
}

async function runWhisper(args, options) {
  try {
    return await run(WHISPER_CLI, ["-m", LOCAL_MODEL_PATH, ...args], options);
  } catch (error) {
    if (/not installed or not on PATH/.test(error.message)) {
      throw new PermanentError("whisper.cpp isn't installed. Run: brew install whisper-cpp — then restart and press Retry.");
    }
    throw error;
  }
}

/**
 * Detect the spoken language from a 30-second sample.
 *
 * Sampled a little way in rather than at 0:00, which is often an intro jingle
 * that whisper happily labels as English.
 */
export async function detectLanguage(audioPath, { durationSec = 0 } = {}) {
  const offsetMs = Math.round(Math.min(120, Math.max(0, durationSec - 30) * 0.2) * 1000);
  const { stderr } = await runWhisper(
    ["-f", audioPath, "-l", "auto", "-dl", "-ot", String(offsetMs)],
    { timeoutMs: 5 * 60 * 1000 }
  );
  return parseDetectedLanguage(stderr);
}

/**
 * Transcribe a 16 kHz mono WAV with whisper.cpp.
 *
 * @param {string} audioPath see ffmpeg.extractAudioWav
 * @param {{language?: string, durationSec?: number}} [options]
 * @returns {Promise<{language:string, text:string, words:Array}>}
 */
export async function transcribeLocally(audioPath, { language, durationSec } = {}) {
  const problem = localTranscriptionProblem();
  if (problem) throw new PermanentError(problem);

  const lang = language || (await detectLanguage(audioPath, { durationSec })) || "auto";
  const prompt = LANGUAGE_PROMPTS[lang];

  const outBase = path.join(path.dirname(audioPath), "whisper-out");
  const threads = Math.max(2, Math.min(8, os.availableParallelism?.() ?? os.cpus().length));

  await runWhisper(
    [
      "-f", audioPath,
      "-l", lang,
      "-t", String(threads),
      "-ml", "1", "-sow",
      ...(prompt ? ["--prompt", prompt, "--carry-initial-prompt"] : []),
      "-oj", "-of", outBase,
      "-np",
    ],
    // Local runs scale with length; allow three hours for very long sources.
    { timeoutMs: 3 * 60 * 60 * 1000 }
  );

  const payload = JSON.parse(await fs.promises.readFile(`${outBase}.json`, "utf8"));
  const result = parseWhisperCppJson(payload);
  return lang !== "auto" ? { ...result, language: lang } : result;
}
