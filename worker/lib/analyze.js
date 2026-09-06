import Anthropic from "@anthropic-ai/sdk";
import { computeSignals, combineScores } from "./signals.js";

/**
 * Viral-moment detection.
 *
 * The model reads a timestamped transcript and proposes moments; the
 * deterministic signals in signals.js then correct and score them. Splitting it
 * this way is what makes the output stable — asking a model to rank 30
 * candidates directly gives a different order every run.
 *
 * Model choice: Claude Opus 5. It is a judgement task on long context, which is
 * exactly where the capability difference shows up, and at roughly $0.11 per
 * 60-minute video it is a small share of the ~$0.009/min cost of processing.
 * Override with CLIPCORE_ANALYSIS_MODEL if you want to trade quality for cost.
 */

const MODEL = process.env.CLIPCORE_ANALYSIS_MODEL || "claude-opus-5";

/** Tool schema. `strict: true` guarantees the arguments validate exactly. */
const MOMENTS_TOOL = {
  name: "report_moments",
  description:
    "Report the strongest standalone moments found in the transcript, best first.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      moments: {
        type: "array",
        description: "The selected moments, strongest first.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            startSec: { type: "number", description: "Start time in seconds, from the transcript timestamps." },
            endSec: { type: "number", description: "End time in seconds. Aim for 20-60 seconds." },
            title: { type: "string", description: "A short, specific title. No clickbait punctuation." },
            hook: { type: "string", description: "The first sentence a viewer hears, quoted from the transcript." },
            summary: { type: "string", description: "One sentence on what happens in this moment." },
            reasoning: { type: "string", description: "Why this specific moment would hold attention. Be concrete." },
            viral: { type: "number", description: "0-100: likelihood this spreads on short-form feeds." },
            clip: { type: "number", description: "0-100: how well it stands alone without surrounding context." },
            confidence: { type: "number", description: "0-100: your confidence in this assessment." },
          },
          required: ["startSec", "endSec", "title", "hook", "summary", "reasoning", "viral", "clip", "confidence"],
        },
      },
    },
    required: ["moments"],
  },
};

const SYSTEM_PROMPT = `You find the moments in long-form video that work as standalone short-form clips.

What makes a moment work:
- It opens on something that stops a scroll — a claim, a question, a surprising admission, a strong reaction.
- It resolves. A viewer reaches the end feeling they got the point, not that they were cut off.
- It stands alone. No unexplained pronouns, no "as I said earlier", no reliance on what came before.
- It is 20-60 seconds. Shorter rarely lands a point; longer loses people.

What does not work, however energetic it sounds: intros, sponsor reads, housekeeping, sign-offs, tangents that need setup, and anything whose payoff happens outside the window.

Choose boundaries on sentence edges using the timestamps given. Start slightly before the hook line so it is not clipped. Never invent a timestamp that is not supported by the transcript.

Be honest in your scores. A transcript with no strong moments should get low scores rather than inflated ones — a wrong high score costs the user credits and their audience's attention.`;

/**
 * Render words into a timestamped transcript the model can cite.
 *
 * One line per chunk with a start time, so the model can only choose boundaries
 * that actually exist.
 */
export function formatTranscript(words, { chunkSeconds = 10 } = {}) {
  if (words.length === 0) return "";

  const lines = [];
  let bucketStart = words[0].start;
  let bucket = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const mm = String(Math.floor(bucketStart / 60)).padStart(2, "0");
    const ss = String(Math.floor(bucketStart % 60)).padStart(2, "0");
    lines.push(`[${mm}:${ss} | ${bucketStart.toFixed(1)}s] ${bucket.map((w) => w.w).join(" ")}`);
    bucket = [];
  };

  for (const word of words) {
    if (word.start - bucketStart >= chunkSeconds) {
      flush();
      bucketStart = word.start;
    }
    bucket.push(word);
  }
  flush();

  return lines.join("\n");
}

/** Clamp a proposed moment to the video and to a sane clip length. */
export function sanitizeMoment(moment, { videoDuration, minSec = 8, maxSec = 90 }) {
  let start = Number(moment.startSec);
  let end = Number(moment.endSec);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  start = Math.max(0, Math.min(start, videoDuration));
  end = Math.max(0, Math.min(end, videoDuration));
  if (end <= start) return null;

  // Trim an over-long proposal from the end rather than dropping it: the hook
  // is at the start, so the front is the part worth keeping.
  if (end - start > maxSec) end = start + maxSec;
  if (end - start < minSec) return null;

  return {
    ...moment,
    startSec: Math.round(start * 100) / 100,
    endSec: Math.round(end * 100) / 100,
  };
}

/** Drop later moments that overlap an earlier, higher-ranked one. */
export function dedupeOverlaps(moments, { maxOverlapRatio = 0.35 } = {}) {
  const kept = [];

  for (const moment of moments) {
    const duration = moment.endSec - moment.startSec;
    const clashes = kept.some((existing) => {
      const overlap =
        Math.min(moment.endSec, existing.endSec) - Math.max(moment.startSec, existing.startSec);
      return overlap > 0 && overlap / duration > maxOverlapRatio;
    });
    if (!clashes) kept.push(moment);
  }

  return kept;
}

/** Words falling inside a moment's window. */
function wordsBetween(words, startSec, endSec) {
  return words.filter((w) => w.end > startSec && w.start < endSec);
}

/**
 * Find and score the best moments in a transcript.
 *
 * @param {Array<{w:string,start:number,end:number}>} words
 * @param {{videoDuration:number, targetCount?:number, client?:Anthropic}} options
 * @returns {Promise<Array>} scored moments, strongest first
 */
export async function analyzeTranscript(words, { videoDuration, targetCount = 10, client } = {}) {
  if (words.length === 0) return [];

  const anthropic = client ?? new Anthropic();
  const transcript = formatTranscript(words);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    tools: [MOMENTS_TOOL],
    tool_choice: { type: "tool", name: "report_moments" },
    messages: [
      {
        role: "user",
        content: `Find the ${targetCount} strongest standalone moments in this ${Math.round(
          videoDuration / 60
        )}-minute transcript. Return fewer than ${targetCount} if the material does not support that many.

<transcript>
${transcript}
</transcript>`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block) => block.type === "tool_use" && block.name === "report_moments"
  );
  if (!toolUse) {
    throw new Error("Analysis returned no moments");
  }

  const proposed = Array.isArray(toolUse.input?.moments) ? toolUse.input.moments : [];

  const cleaned = proposed
    .map((moment) => sanitizeMoment(moment, { videoDuration }))
    .filter(Boolean);

  const scored = cleaned.map((moment) => {
    const windowWords = wordsBetween(words, moment.startSec, moment.endSec);
    const signals = computeSignals(windowWords);
    const scores = combineScores({
      signals,
      modelScores: { viral: moment.viral, clip: moment.clip, confidence: moment.confidence },
      durationSec: moment.endSec - moment.startSec,
    });

    return {
      startSec: moment.startSec,
      endSec: moment.endSec,
      title: String(moment.title || "").slice(0, 200),
      hook: String(moment.hook || "").slice(0, 500),
      summary: String(moment.summary || "").slice(0, 1000),
      reasoning: String(moment.reasoning || "").slice(0, 2000),
      ...scores,
    };
  });

  scored.sort((a, b) => b.viralScore - a.viralScore);
  return dedupeOverlaps(scored).slice(0, targetCount);
}

export { MOMENTS_TOOL, SYSTEM_PROMPT, MODEL };
