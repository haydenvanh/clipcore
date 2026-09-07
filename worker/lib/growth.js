/**
 * Growth intelligence, derived from signals we actually measure.
 *
 * Honesty note that matters for the UI: the viral, clip, and hook numbers come
 * from real measurement (the deterministic signals in signals.js plus the
 * model's judgement). **Retention is a heuristic estimate, not a prediction
 * from observed performance** — we have no watch-time data yet. It is labelled
 * as an estimate everywhere it is shown, and this module is where that
 * distinction is defined rather than buried in a component.
 */

/** Platform constraints, mirroring src/lib/social/*. */
const PLATFORMS = [
  { id: "TIKTOK", label: "TikTok", ideal: [15, 60], max: 600, ratios: ["RATIO_9_16"] },
  { id: "INSTAGRAM", label: "Instagram Reels", ideal: [15, 90], max: 900, ratios: ["RATIO_9_16"] },
  { id: "YOUTUBE", label: "YouTube Shorts", ideal: [20, 60], max: 180, ratios: ["RATIO_9_16", "RATIO_1_1", "RATIO_16_9"] },
  { id: "FACEBOOK", label: "Facebook Reels", ideal: [20, 90], max: 5400, ratios: ["RATIO_9_16"] },
];

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const pct = (n) => Math.round(clamp01(n) * 100);

/**
 * Why a clip scored the way it did, as a checklist.
 *
 * Reads the stored per-signal breakdown, so every line is traceable to a
 * measurement rather than being generic copy.
 */
export function explainScore(signals = {}) {
  const get = (key) => Number(signals[key] ?? 0) / 100;

  const criteria = [
    { key: "hook", label: "Strong hook", value: get("hook"), threshold: 0.4 },
    { key: "emotion", label: "High emotion", value: get("emotion"), threshold: 0.35 },
    { key: "speechIntensity", label: "Fast pacing", value: get("speechIntensity"), threshold: 0.45 },
    { key: "reactions", label: "Audience reaction", value: get("reactions"), threshold: 0.25 },
    { key: "questions", label: "Open curiosity gap", value: get("questions"), threshold: 0.3 },
  ];

  return criteria.map((c) => ({
    label: c.label,
    met: c.value >= c.threshold,
    strength: pct(c.value),
  }));
}

/**
 * Estimated retention curve across intro / middle / payoff.
 *
 * A heuristic, not a measurement: a strong hook holds the intro, pacing holds
 * the middle, and a clip that overruns its ideal length loses the payoff.
 * Replace this with observed watch-time the moment we have any.
 */
export function estimateRetention({ signals = {}, durationSec = 40 }) {
  const hook = Number(signals.hook ?? 40) / 100;
  const pace = Number(signals.speechIntensity ?? 50) / 100;
  const emotion = Number(signals.emotion ?? 40) / 100;

  // Short clips retain better; past ~75s attention falls away.
  const lengthPenalty = durationSec <= 60 ? 0 : Math.min(0.35, (durationSec - 60) / 200);

  const intro = clamp01(0.72 + hook * 0.28);
  const middle = clamp01(intro - 0.14 + pace * 0.12 - lengthPenalty);
  const payoff = clamp01(middle - 0.09 + emotion * 0.1 - lengthPenalty * 0.5);

  const points = [
    { label: "Intro", at: 0, value: pct(intro) },
    { label: "Middle", at: 50, value: pct(middle) },
    { label: "Payoff", at: 100, value: pct(payoff) },
  ];

  // Flag the steepest fall so the UI can point at something specific.
  const drops = [];
  if (intro - middle > 0.16) drops.push({ at: 35, reason: "Pacing dips after the hook" });
  if (middle - payoff > 0.14) drops.push({ at: 80, reason: "Payoff arrives late" });

  return {
    overall: pct((intro + middle + payoff) / 3),
    points,
    drops,
    estimated: true, // never render this as a measured number
  };
}

/**
 * Rank platforms for a clip.
 *
 * Real logic over real constraints: aspect ratio compatibility is a hard gate,
 * then distance from each platform's ideal length, then the clip's own scores.
 */
export function recommendPlatforms({ durationSec = 40, aspectRatio = "RATIO_9_16", viralScore = 50 }) {
  return PLATFORMS.map((platform) => {
    const ratioOk = platform.ratios.includes(aspectRatio);
    const [lo, hi] = platform.ideal;

    let fit = 1;
    if (durationSec < lo) fit = Math.max(0.35, durationSec / lo);
    else if (durationSec > hi) fit = Math.max(0.3, 1 - (durationSec - hi) / (platform.max - hi + 1));

    const confidence = clamp01(
      (ratioOk ? 1 : 0.25) * (fit * 0.55 + (viralScore / 100) * 0.45)
    );

    return {
      id: platform.id,
      label: platform.label,
      confidence: pct(confidence),
      compatible: ratioOk && durationSec <= platform.max,
    };
  }).sort((a, b) => b.confidence - a.confidence);
}

/**
 * Concrete edits, derived from the same signals.
 *
 * Every suggestion names a measurement and an action. "Improve your hook" is
 * useless; "shorten the opening by 1.2s — the hook lands at 1.2s" is not.
 */
export function growthSuggestions({ signals = {}, durationSec = 40, hookStartSec = 0 }) {
  const out = [];
  const get = (key) => Number(signals[key] ?? 0) / 100;

  if (hookStartSec > 0.4) {
    out.push({
      id: "trim-open",
      text: `Shorten the opening by ${hookStartSec.toFixed(1)}s — the hook lands after the first frame.`,
      impact: "high",
    });
  }
  if (durationSec > 75) {
    out.push({
      id: "move-payoff",
      text: `Move the payoff earlier; at ${Math.round(durationSec)}s the ending sits past most retention.`,
      impact: "high",
    });
  }
  if (get("emotion") < 0.35) {
    out.push({ id: "caption-emphasis", text: "Add caption emphasis — emotional language is low in this cut.", impact: "medium" });
  }
  if (get("speechIntensity") < 0.4) {
    out.push({ id: "tighten", text: "Tighten pauses; delivery is slower than clips that travel.", impact: "medium" });
  }
  if (get("reactions") < 0.2) {
    out.push({ id: "broll", text: "Add B-roll over the flat section to hold attention.", impact: "low" });
  }

  return out.slice(0, 5);
}

/** Everything the Growth panel needs, from one clip record. */
export function buildGrowthReport(clip) {
  const signals = clip?.signals ?? {};
  const durationSec = Math.max(1, (clip?.endSec ?? 40) - (clip?.startSec ?? 0));

  return {
    viralScore: Math.round(clip?.viralScore ?? 0),
    clipScore: Math.round(clip?.clipScore ?? 0),
    confidence: Math.round(clip?.confidence ?? 0),
    hookStrength: Math.round(Number(signals.hook ?? 0)),
    reasons: explainScore(signals),
    retention: estimateRetention({ signals, durationSec }),
    platforms: recommendPlatforms({
      durationSec,
      aspectRatio: clip?.aspectRatio ?? "RATIO_9_16",
      viralScore: clip?.viralScore ?? 50,
    }),
    suggestions: growthSuggestions({ signals, durationSec }),
    reasoning: clip?.reasoning ?? null,
    durationSec,
  };
}

export { PLATFORMS };
