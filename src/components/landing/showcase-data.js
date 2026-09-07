/**
 * Static data for the product showcase.
 *
 * A plain module, not exported from the "use client" component, so the server
 * can read it too — a value crossing the client boundary arrives as a reference
 * proxy rather than data.
 */

/** Transcript words, with the ones the scorer flagged as the hook. */
export const TRANSCRIPT = [
  { w: "So", hook: false }, { w: "the", hook: false }, { w: "thing", hook: false },
  { w: "nobody", hook: true }, { w: "tells", hook: true }, { w: "you", hook: true },
  { w: "about", hook: false }, { w: "scaling", hook: false }, { w: "is", hook: false },
  { w: "that", hook: false }, { w: "the", hook: false }, { w: "first", hook: false },
  { w: "hire", hook: true }, { w: "changes", hook: true }, { w: "everything.", hook: true },
  { w: "We", hook: false }, { w: "got", hook: false }, { w: "it", hook: false },
  { w: "wrong", hook: true }, { w: "twice.", hook: true },
];

/**
 * The pipeline stages, in the order they actually run in the worker.
 * `live: false` marks a capability that is not built yet — labelling it
 * honestly costs one property and avoids implying something that does not ship.
 */
export const AI_ACTIONS = [
  { id: "captioning", label: "Auto Captioning", live: true },
  { id: "detection", label: "Clip Detection", live: true },
  { id: "speaker", label: "Speaker Tracking", live: false },
  { id: "hook", label: "Hook Analysis", live: true },
  { id: "scoring", label: "Viral Scoring", live: true },
];

export const TOOLS = [
  { id: "captions", label: "Captions", live: true },
  { id: "hook", label: "AI Hook", live: true },
  { id: "score", label: "Viral Score", live: true },
  { id: "broll", label: "B-Roll", live: false },
  { id: "music", label: "Music", live: false },
  { id: "branding", label: "Branding", live: false },
  { id: "assets", label: "Upload Assets", live: true },
];

/** Detected moments on the timeline, positioned as percentages of the source. */
export const MOMENTS = [
  { id: "m1", score: 98, start: 8, width: 13, label: "The first hire" },
  { id: "m2", score: 96, start: 38, width: 11, label: "Got it wrong twice" },
  { id: "m3", score: 92, start: 68, width: 14, label: "What we'd change" },
];

/** Deterministic waveform, so server and client render identical markup. */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seeded(41);
export const WAVEFORM = Array.from({ length: 96 }, (_, i) => {
  // A slow envelope over noise reads as speech rather than static.
  const envelope = 0.45 + 0.4 * Math.abs(Math.sin(i / 7));
  const value = Math.max(0.12, Math.min(1, envelope * (0.55 + rand() * 0.7)));

  // Rounded deliberately. These feed a CSS percentage, and React serializes a
  // full-precision float differently on the server than in the browser
  // (46.53982277801579% vs 46.5398%), which trips a hydration mismatch on every
  // bar. Two decimals is far finer than a pixel at these sizes.
  return Math.round(value * 10000) / 10000;
});
