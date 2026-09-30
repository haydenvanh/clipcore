import { computeSignals } from "./signals.js";

/**
 * Pick clip-worthy moments without a language model.
 *
 * Used when no ANTHROPIC_API_KEY is set. It works from the same deterministic
 * signals the model-based path uses to score its picks (pace, reactions,
 * emotional language, opening hooks, questions, topic shifts), but has nothing
 * that can judge whether a moment *makes sense* on its own. So:
 *
 * - Every candidate starts and ends on a sentence boundary. A clip that begins
 *   mid-thought is the most common way auto-generated clips feel broken, and
 *   sentence edges are the one piece of structure available without a model.
 * - Candidates opening on a word that leans on what came before ("and",
 *   "because", "which"…) are penalised for the same reason.
 * - Confidence is reported low, because these are signal-only guesses.
 */

const SENTENCE_END = /[.!?…]["')\]]*$/;
/** A pause this long ends a sentence even without punctuation. */
const PAUSE_BREAK_SEC = 1.2;

/** Words that open a sentence which depends on the previous one. */
const DANGLING_OPENERS = new Set([
  "and", "but", "or", "because", "which", "that", "so", "then", "also", "plus",
  "though", "although", "however", "it", "this", "they", "he", "she", "those", "these",
]);

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const to100 = (n) => Math.round(clamp01(n) * 1000) / 10;

/** Group words into sentences on terminal punctuation or a long pause. */
export function splitSentences(words) {
  const sentences = [];
  let current = [];

  words.forEach((word, i) => {
    current.push(word);
    const next = words[i + 1];
    const endsHere =
      SENTENCE_END.test(String(word.w)) ||
      (next && next.start - word.end >= PAUSE_BREAK_SEC);
    if (endsHere || !next) {
      sentences.push(current);
      current = [];
    }
  });

  return sentences.filter((s) => s.length > 0);
}

/**
 * Take the best candidates, best first, skipping any that land within
 * `minGapSec` of one already taken.
 *
 * Plain overlap removal isn't enough: the best-scoring stretch of a podcast
 * otherwise yields five back-to-back slices of the same conversation.
 */
export function pickSpread(candidates, { count, minGapSec = 0 }) {
  const picked = [];
  for (const c of candidates) {
    if (picked.length >= count) break;
    const clashes = picked.some((p) => c.startSec < p.endSec + minGapSec && p.startSec < c.endSec + minGapSec);
    if (!clashes) picked.push(c);
  }
  return picked;
}

/** 1.0 inside the ideal range, falling off either side. */
export function lengthFit(durationSec, { ideal = [25, 45], min = 12, max = 60 } = {}) {
  const [lo, hi] = ideal;
  if (durationSec >= lo && durationSec <= hi) return 1;
  if (durationSec < lo) return clamp01((durationSec - min * 0.5) / (lo - min * 0.5));
  return clamp01(1 - (durationSec - hi) / (max - hi + 15));
}

function firstWord(sentence) {
  return String(sentence[0]?.w ?? "").toLowerCase().replace(/[^a-z']/g, "");
}

function textOf(words) {
  return words.map((w) => w.w).join(" ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

/**
 * The opening sentence, extended by the ones after it while it's too short to
 * say anything — "Crazy." makes a poor title; "Crazy. Remember when they
 * sliced Jett." does not.
 */
export function openingWords(sentences, minChars = 25) {
  const words = [];
  for (const sentence of sentences) {
    words.push(...sentence);
    if (textOf(words).length >= minChars) break;
  }
  return words;
}

/** A readable title from the opening sentence, cut on a word boundary. */
export function titleFrom(sentence, maxLength = 60) {
  const text = textOf(sentence).replace(/[.!?…,;:]+$/, "");
  if (text.length <= maxLength) return text.charAt(0).toUpperCase() + text.slice(1);
  const cut = text.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${cut.charAt(0).toUpperCase()}${cut.slice(1)}…`;
}

/** Describe the strongest signals, so the choice is explainable. */
function explain(signals, standalone) {
  const labels = {
    hook: "opens on a hook",
    reactions: "has an audible reaction",
    emotion: "uses emotionally charged language",
    speechIntensity: "is delivered at a fast pace",
    questions: "poses a question",
    topicShift: "starts a new topic",
  };
  const strong = Object.entries(labels)
    .filter(([key]) => (signals[key] ?? 0) >= 0.35)
    .sort(([a], [b]) => (signals[b] ?? 0) - (signals[a] ?? 0))
    .slice(0, 3)
    .map(([, label]) => label);

  const parts = [];
  parts.push(strong.length ? `Chosen because it ${strong.join(", ")}.` : "Chosen as the strongest remaining stretch of speech.");
  if (standalone < 1) parts.push("Opens on a word that may depend on earlier context.");
  parts.push("Scored from the transcript alone — no AI model reviewed it.");
  return parts.join(" ");
}

/**
 * @param {Array<{w:string,start:number,end:number}>} words
 * @param {{videoDuration:number, targetCount?:number}} options
 * @returns {Array} moments in the same shape analyzeTranscript returns
 */
export function selectMomentsLocally(words, { videoDuration, targetCount = 10 } = {}) {
  if (!Array.isArray(words) || words.length === 0) return [];

  const sentences = splitSentences(words);
  const total = videoDuration || words[words.length - 1].end;

  // Short sources can't produce 25-second clips; scale the floor down so a
  // two-minute video still yields something.
  const minSec = Math.max(6, Math.min(20, total * 0.3));
  const maxSec = Math.min(60, Math.max(minSec + 5, total));

  const candidates = [];
  for (let i = 0; i < sentences.length; i++) {
    const startSec = sentences[i][0].start;
    let windowWords = [];

    for (let j = i; j < sentences.length; j++) {
      windowWords = windowWords.concat(sentences[j]);
      const endSec = sentences[j][sentences[j].length - 1].end;
      const duration = endSec - startSec;
      if (duration > maxSec) break;
      if (duration < minSec) continue;

      const signals = computeSignals(windowWords);
      const standalone = DANGLING_OPENERS.has(firstWord(sentences[i])) ? 0.55 : 1;
      const fit = lengthFit(duration, { min: minSec, max: maxSec });

      // Weighted toward engagement, but a clip that opens mid-thought or runs
      // badly long is pulled down regardless of how lively it is.
      const viral = (0.7 * signals.engagement + 0.3 * fit) * (0.6 + 0.4 * standalone);
      const clip = 0.5 * standalone + 0.5 * fit;

      candidates.push({
        startSec: Math.max(0, startSec - 0.15), // a breath before the first word
        endSec: Math.min(total, endSec + 0.3), // and after the last
        opening: openingWords(sentences.slice(i, j + 1)),
        windowWords,
        signals,
        standalone,
        viral,
        clip,
      });
    }
  }

  // Nothing fits the window (e.g. a single long sentence): take the whole
  // thing, capped, rather than returning no clips at all.
  if (candidates.length === 0 && total >= 3) {
    const signals = computeSignals(words);
    candidates.push({
      startSec: Math.max(0, words[0].start - 0.15),
      endSec: Math.min(total, Math.min(words[words.length - 1].end + 0.3, words[0].start + 60)),
      opening: openingWords(sentences),
      windowWords: words,
      signals,
      standalone: 1,
      viral: signals.engagement,
      clip: 0.6,
    });
  }

  candidates.sort((a, b) => b.viral - a.viral);

  // Spread picks across the video: up to five minutes apart on a long
  // podcast, a few seconds on a short clip.
  const minGapSec = Math.min(300, total / (targetCount * 2));
  const picked = pickSpread(candidates, { count: targetCount, minGapSec });

  return picked.map((c) => ({
    startSec: Math.round(c.startSec * 100) / 100,
    endSec: Math.round(c.endSec * 100) / 100,
    title: titleFrom(c.opening),
    hook: textOf(c.opening).slice(0, 500),
    summary: textOf(c.windowWords).slice(0, 280),
    reasoning: explain(c.signals, c.standalone),
    viralScore: to100(c.viral),
    clipScore: to100(c.clip),
    // Low on purpose: nothing has judged whether the moment makes sense.
    confidence: to100(0.35 + 0.15 * c.standalone),
    signals: Object.fromEntries(Object.entries(c.signals).map(([k, v]) => [k, to100(v)])),
  }));
}
