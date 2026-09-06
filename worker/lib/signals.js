/**
 * Deterministic engagement signals, computed from the transcript alone.
 *
 * These exist so scores are not pure model vibes. The language model is good at
 * judging *why* a moment lands; it is unreliable at consistently ranking dozens
 * of candidates against each other. Measuring what is measurable — pace,
 * reactions, question density, topic movement — and letting the model judge the
 * rest gives scores that are stable between runs on the same video.
 *
 * Everything here is pure: same words in, same numbers out.
 */

/** Audience reactions transcribers actually emit, plus common written forms. */
const REACTION_PATTERNS = [
  /\b(laugh(s|ter|ing)?|chuckl\w*|giggl\w*)\b/i,
  /\b(applause|clap(s|ping)?|cheer(s|ing)?)\b/i,
  /\b(gasp(s|ing)?|woah|whoa|wow)\b/i,
  /\[\s*(laughter|applause|music|cheering)\s*\]/i,
  /\(\s*(laughs|applause|laughter)\s*\)/i,
];

/** Words that mark emotional or superlative intensity. */
const EMOTION_WORDS = new Set([
  "amazing", "incredible", "unbelievable", "insane", "crazy", "shocking",
  "terrifying", "devastating", "brilliant", "beautiful", "horrible", "awful",
  "hate", "love", "furious", "excited", "terrified", "heartbreaking",
  "obsessed", "desperate", "extraordinary", "ridiculous", "outrageous",
  "never", "always", "everyone", "nobody", "everything", "nothing",
  "best", "worst", "biggest", "hardest", "scariest", "favorite",
]);

/** Phrases that introduce a payoff — strong openings for a clip. */
const HOOK_PATTERNS = [
  /\b(here'?s the thing|the truth is|what nobody tells you|the secret)\b/i,
  /\b(i (was|had) (never|completely|totally)|i'?ll never forget)\b/i,
  /\b(most people (think|believe|assume)|everybody thinks)\b/i,
  /\b(the (biggest|number one|hardest|worst) (mistake|problem|thing))\b/i,
  /\b(let me tell you|imagine|picture this|think about it)\b/i,
];

/** Discourse markers that signal a new subject is starting. */
const TOPIC_SHIFT_PATTERNS = [
  /\b(so anyway|moving on|another thing|next up|let'?s talk about)\b/i,
  /\b(but here'?s|now,? (the|what|here)|which brings me to)\b/i,
  /\b(speaking of|on that note|that reminds me)\b/i,
];

/** Map any number onto 0..1 with a soft knee at `mid`. */
function normalize(value, mid) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value / (value + mid);
}

function textOf(words) {
  return words.map((w) => w.w).join(" ");
}

/**
 * Words per second across the window.
 *
 * A proxy for delivery energy: people speed up when they are animated and slow
 * down when they are reading or hesitating.
 */
export function speechIntensity(words) {
  if (words.length < 2) return 0;
  const span = words[words.length - 1].end - words[0].start;
  if (span <= 0) return 0;

  const wordsPerSecond = words.length / span;
  // Conversational speech is ~2.5 w/s; 4+ is animated.
  return Math.max(0, Math.min(1, (wordsPerSecond - 1.5) / 2.5));
}

/** Laughter, applause, and audible reactions in the window. */
export function reactionScore(words) {
  const text = textOf(words);
  const hits = REACTION_PATTERNS.reduce(
    (count, pattern) => count + (pattern.test(text) ? 1 : 0),
    0
  );
  return normalize(hits, 1.5);
}

/** Density of emotionally loaded and absolute language. */
export function emotionScore(words) {
  if (words.length === 0) return 0;
  const hits = words.filter((w) =>
    EMOTION_WORDS.has(String(w.w).toLowerCase().replace(/[^a-z']/g, ""))
  ).length;
  // ~4% emotional words is already a charged passage.
  return Math.max(0, Math.min(1, hits / words.length / 0.04));
}

/** Whether the window opens on a recognisable hook. */
export function hookScore(words) {
  const opening = textOf(words.slice(0, 25));
  const hits = HOOK_PATTERNS.reduce((c, p) => c + (p.test(opening) ? 1 : 0), 0);
  return Math.min(1, hits * 0.6);
}

/** Whether a new subject starts near the beginning of the window. */
export function topicShiftScore(words) {
  const opening = textOf(words.slice(0, 20));
  const hits = TOPIC_SHIFT_PATTERNS.reduce((c, p) => c + (p.test(opening) ? 1 : 0), 0);
  return Math.min(1, hits * 0.5);
}

/**
 * Question density.
 *
 * Rhetorical questions are how a speaker opens a loop, and open loops are what
 * keep someone watching past the first two seconds.
 */
export function questionScore(words) {
  const text = textOf(words);
  const questions = (text.match(/\?/g) || []).length;
  const interrogatives = (text.match(/\b(why|how|what if|do you|have you|ever wondered)\b/gi) || []).length;
  return normalize(questions + interrogatives * 0.5, 2);
}

/**
 * All signals for one window, plus a single weighted engagement number.
 *
 * @param {Array<{w:string,start:number,end:number}>} words
 */
export function computeSignals(words) {
  const signals = {
    speechIntensity: speechIntensity(words),
    reactions: reactionScore(words),
    emotion: emotionScore(words),
    hook: hookScore(words),
    topicShift: topicShiftScore(words),
    questions: questionScore(words),
  };

  // Weights favour what survives a scroll: an opening hook and audible
  // reactions beat raw talking speed.
  const engagement =
    signals.hook * 0.28 +
    signals.reactions * 0.22 +
    signals.emotion * 0.2 +
    signals.speechIntensity * 0.15 +
    signals.questions * 0.1 +
    signals.topicShift * 0.05;

  return { ...signals, engagement: Math.max(0, Math.min(1, engagement)) };
}

/** Round to one decimal on a 0..100 scale. */
function to100(value) {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 10;
}

/**
 * Blend the deterministic signals with the model's judgement.
 *
 * - viralScore  — how likely this travels. Model-led, signal-corrected.
 * - clipScore   — how well it works as a standalone clip (self-contained,
 *                 well-bounded, right length). Model-led.
 * - confidence  — how much to trust the above. Rises when the model and the
 *                 signals agree and the clip is a sane length; falls when they
 *                 disagree, which is exactly when a human should look.
 */
export function combineScores({ signals, modelScores, durationSec }) {
  const signalScore = signals.engagement;
  const modelViral = Math.max(0, Math.min(1, (modelScores?.viral ?? 50) / 100));
  const modelClip = Math.max(0, Math.min(1, (modelScores?.clip ?? 50) / 100));

  // 65/35 toward the model: it reads meaning, the signals only read form.
  const viral = modelViral * 0.65 + signalScore * 0.35;

  // Clips shorter than 15s rarely land a point; past 75s retention falls away.
  let lengthFit = 1;
  if (durationSec < 15) lengthFit = Math.max(0.3, durationSec / 15);
  else if (durationSec > 75) lengthFit = Math.max(0.4, 1 - (durationSec - 75) / 120);

  const clip = modelClip * 0.7 + lengthFit * 0.3;

  const agreement = 1 - Math.abs(modelViral - signalScore);
  const confidence = agreement * 0.6 + lengthFit * 0.25 + (modelScores?.confidence ?? 70) / 100 * 0.15;

  return {
    viralScore: to100(viral),
    clipScore: to100(clip),
    confidence: to100(confidence),
    signals: Object.fromEntries(Object.entries(signals).map(([k, v]) => [k, to100(v)])),
  };
}
