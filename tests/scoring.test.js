import { describe, it, expect, vi } from "vitest";
import {
  computeSignals, combineScores, speechIntensity, reactionScore,
  emotionScore, hookScore, questionScore,
} from "../worker/lib/signals.js";
import {
  formatTranscript, sanitizeMoment, dedupeOverlaps, analyzeTranscript, MOMENTS_TOOL,
} from "../worker/lib/analyze.js";

/** Build words at a fixed rate so pace is controllable. */
function words(text, { start = 0, wordsPerSecond = 2.5 } = {}) {
  const step = 1 / wordsPerSecond;
  return text.split(/\s+/).map((w, i) => ({
    w, start: start + i * step, end: start + (i + 1) * step,
  }));
}

describe("individual signals", () => {
  it("rates fast delivery above slow delivery", () => {
    const fast = speechIntensity(words("a b c d e f g h i j", { wordsPerSecond: 4.5 }));
    const slow = speechIntensity(words("a b c d e f g h i j", { wordsPerSecond: 1.6 }));
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThanOrEqual(1);
    expect(slow).toBeGreaterThanOrEqual(0);
  });

  it("needs at least two words to measure pace", () => {
    expect(speechIntensity([])).toBe(0);
    expect(speechIntensity(words("hello"))).toBe(0);
  });

  it("detects audience reactions in both transcriber conventions", () => {
    expect(reactionScore(words("and then [laughter] he said"))).toBeGreaterThan(0);
    expect(reactionScore(words("the crowd erupted in applause"))).toBeGreaterThan(0);
    expect(reactionScore(words("we reviewed the quarterly figures"))).toBe(0);
  });

  it("scores emotionally loaded language above neutral language", () => {
    const charged = emotionScore(words("this is absolutely insane and incredible honestly"));
    const neutral = emotionScore(words("the report was filed on tuesday as planned"));
    expect(charged).toBeGreaterThan(neutral);
  });

  it("recognises an opening hook", () => {
    expect(hookScore(words("here's the thing nobody tells you about it"))).toBeGreaterThan(0);
    expect(hookScore(words("so we filed the paperwork on tuesday morning"))).toBe(0);
  });

  it("counts rhetorical questions", () => {
    expect(questionScore(words("why do you think that happened?"))).toBeGreaterThan(0);
    expect(questionScore(words("the meeting concluded at four"))).toBe(0);
  });
});

describe("computeSignals", () => {
  it("returns every signal bounded to 0..1", () => {
    const s = computeSignals(words("here's the thing nobody tells you [laughter] it was absolutely insane why would anyone do that?"));
    for (const [key, value] of Object.entries(s)) {
      expect(value, key).toBeGreaterThanOrEqual(0);
      expect(value, key).toBeLessThanOrEqual(1);
    }
    expect(Object.keys(s)).toContain("engagement");
  });

  it("ranks a charged passage above an administrative one", () => {
    const hot = computeSignals(words("here's the thing nobody tells you [laughter] this is insane why would anyone do that?", { wordsPerSecond: 4 }));
    const cold = computeSignals(words("the agenda item was tabled until the following quarterly review", { wordsPerSecond: 2 }));
    expect(hot.engagement).toBeGreaterThan(cold.engagement);
  });

  it("is deterministic — the same input always scores the same", () => {
    const input = words("here's the thing this is incredible");
    expect(computeSignals(input)).toEqual(computeSignals(input));
  });

  it("handles an empty window without dividing by zero", () => {
    const s = computeSignals([]);
    expect(Number.isFinite(s.engagement)).toBe(true);
    expect(s.engagement).toBe(0);
  });
});

describe("combineScores", () => {
  const signals = computeSignals(words("here's the thing this is incredible"));

  it("returns all three scores on a 0..100 scale", () => {
    const r = combineScores({ signals, modelScores: { viral: 80, clip: 75, confidence: 90 }, durationSec: 35 });
    for (const key of ["viralScore", "clipScore", "confidence"]) {
      expect(r[key]).toBeGreaterThanOrEqual(0);
      expect(r[key]).toBeLessThanOrEqual(100);
    }
  });

  it("penalises a clip that is too short to make a point", () => {
    const short = combineScores({ signals, modelScores: { viral: 80, clip: 80, confidence: 80 }, durationSec: 4 });
    const good = combineScores({ signals, modelScores: { viral: 80, clip: 80, confidence: 80 }, durationSec: 35 });
    expect(short.clipScore).toBeLessThan(good.clipScore);
  });

  it("penalises a clip long past the point of retention", () => {
    const long = combineScores({ signals, modelScores: { viral: 80, clip: 80, confidence: 80 }, durationSec: 180 });
    const good = combineScores({ signals, modelScores: { viral: 80, clip: 80, confidence: 80 }, durationSec: 35 });
    expect(long.clipScore).toBeLessThan(good.clipScore);
  });

  it("lowers confidence when the model and the signals disagree", () => {
    const quiet = computeSignals(words("the agenda item was tabled until next quarter"));
    const disagreeing = combineScores({ signals: quiet, modelScores: { viral: 95, clip: 80, confidence: 80 }, durationSec: 35 });
    const agreeing = combineScores({ signals: quiet, modelScores: { viral: 20, clip: 80, confidence: 80 }, durationSec: 35 });
    expect(disagreeing.confidence).toBeLessThan(agreeing.confidence);
  });

  it("survives a model response with missing scores", () => {
    const r = combineScores({ signals, modelScores: {}, durationSec: 30 });
    expect(Number.isFinite(r.viralScore)).toBe(true);
    expect(Number.isFinite(r.confidence)).toBe(true);
  });

  it("exposes the per-signal breakdown for the UI", () => {
    const r = combineScores({ signals, modelScores: { viral: 50, clip: 50, confidence: 50 }, durationSec: 30 });
    expect(r.signals).toHaveProperty("speechIntensity");
    expect(r.signals).toHaveProperty("reactions");
    expect(r.signals).toHaveProperty("emotion");
  });
});

describe("formatTranscript", () => {
  it("emits citable timestamps the model can choose boundaries from", () => {
    // 25 words at 1/sec spans 25s, so a 10s chunk size yields three lines.
    const text = Array.from({ length: 25 }, (_, i) => `w${i}`).join(" ");
    const t = formatTranscript(words(text, { wordsPerSecond: 1 }));
    const lines = t.split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^\[00:00 \| 0\.0s\]/);
    expect(lines[1]).toMatch(/^\[00:10 \| 10\.0s\]/);
    expect(lines[2]).toMatch(/^\[00:20 \| 20\.0s\]/);
  });

  it("pads minutes and seconds past the one-minute mark", () => {
    const text = Array.from({ length: 130 }, (_, i) => `w${i}`).join(" ");
    const t = formatTranscript(words(text, { wordsPerSecond: 1 }));
    expect(t).toContain("[01:00 | 60.0s]");
    expect(t).toContain("[02:00 | 120.0s]");
  });

  it("returns empty string for no words", () => {
    expect(formatTranscript([])).toBe("");
  });
});

describe("sanitizeMoment", () => {
  const opts = { videoDuration: 600 };

  it("clamps a moment that runs past the end of the video", () => {
    const m = sanitizeMoment({ startSec: 580, endSec: 9999 }, opts);
    expect(m.endSec).toBeLessThanOrEqual(600);
  });

  it("trims an over-long moment from the end, keeping the hook", () => {
    const m = sanitizeMoment({ startSec: 10, endSec: 400 }, opts);
    expect(m.startSec).toBe(10);
    expect(m.endSec - m.startSec).toBeLessThanOrEqual(90);
  });

  it("rejects a moment that is too short, inverted, or non-numeric", () => {
    expect(sanitizeMoment({ startSec: 10, endSec: 12 }, opts)).toBeNull();
    expect(sanitizeMoment({ startSec: 100, endSec: 50 }, opts)).toBeNull();
    expect(sanitizeMoment({ startSec: "x", endSec: 50 }, opts)).toBeNull();
    expect(sanitizeMoment({ startSec: 10 }, opts)).toBeNull();
  });

  it("rejects a hallucinated timestamp beyond the video", () => {
    expect(sanitizeMoment({ startSec: 5000, endSec: 5030 }, opts)).toBeNull();
  });
});

describe("dedupeOverlaps", () => {
  it("keeps the first of two heavily overlapping moments", () => {
    const kept = dedupeOverlaps([
      { startSec: 10, endSec: 40 },
      { startSec: 15, endSec: 45 },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].startSec).toBe(10);
  });

  it("keeps moments that merely touch", () => {
    expect(dedupeOverlaps([
      { startSec: 10, endSec: 40 },
      { startSec: 39, endSec: 70 },
    ])).toHaveLength(2);
  });

  it("keeps disjoint moments", () => {
    expect(dedupeOverlaps([
      { startSec: 10, endSec: 40 },
      { startSec: 100, endSec: 130 },
    ])).toHaveLength(2);
  });
});

describe("tool schema", () => {
  it("is strict, so tool_use.input is guaranteed to validate", () => {
    expect(MOMENTS_TOOL.strict).toBe(true);
    expect(MOMENTS_TOOL.input_schema.additionalProperties).toBe(false);
    const item = MOMENTS_TOOL.input_schema.properties.moments.items;
    expect(item.additionalProperties).toBe(false);
    expect(item.required).toEqual(
      expect.arrayContaining(["startSec", "endSec", "title", "viral", "clip", "confidence"])
    );
  });
});

describe("analyzeTranscript", () => {
  const transcriptWords = words(
    "here's the thing nobody tells you about starting a company it is absolutely insane [laughter] why would anyone do that but here's what happened next",
    { wordsPerSecond: 2.5 }
  );

  function fakeClient(moments) {
    return {
      messages: {
        create: vi.fn(async () => ({
          content: [{ type: "tool_use", name: "report_moments", input: { moments } }],
        })),
      },
    };
  }

  it("scores, sorts, and returns the model's moments", async () => {
    const client = fakeClient([
      { startSec: 0, endSec: 30, title: "Weak", hook: "h", summary: "s", reasoning: "r", viral: 30, clip: 40, confidence: 60 },
      { startSec: 40, endSec: 75, title: "Strong", hook: "h", summary: "s", reasoning: "r", viral: 92, clip: 88, confidence: 90 },
    ]);

    const result = await analyzeTranscript(transcriptWords, { videoDuration: 600, client });

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Strong"); // sorted strongest first
    expect(result[0].viralScore).toBeGreaterThan(result[1].viralScore);
    expect(result[0]).toHaveProperty("signals.reactions");
  });

  it("forces the tool call so a prose reply cannot break the pipeline", async () => {
    const client = fakeClient([]);
    await analyzeTranscript(transcriptWords, { videoDuration: 600, client });

    const request = client.messages.create.mock.calls[0][0];
    expect(request.tool_choice).toEqual({ type: "tool", name: "report_moments" });
    expect(request.model).toBe("claude-opus-5");
  });

  it("drops hallucinated and malformed moments instead of persisting them", async () => {
    const client = fakeClient([
      { startSec: 5000, endSec: 5030, title: "Hallucinated", viral: 90, clip: 90, confidence: 90 },
      { startSec: 10, endSec: 12, title: "Too short", viral: 90, clip: 90, confidence: 90 },
      { startSec: 20, endSec: 55, title: "Real", hook: "h", summary: "s", reasoning: "r", viral: 70, clip: 70, confidence: 70 },
    ]);

    const result = await analyzeTranscript(transcriptWords, { videoDuration: 600, client });
    expect(result.map((m) => m.title)).toEqual(["Real"]);
  });

  it("raises when the model returns no tool call at all", async () => {
    const client = { messages: { create: vi.fn(async () => ({ content: [{ type: "text", text: "no" }] })) } };
    await expect(analyzeTranscript(transcriptWords, { videoDuration: 600, client })).rejects.toThrow(/no moments/);
  });

  it("returns nothing for an empty transcript without calling the API", async () => {
    const client = fakeClient([]);
    expect(await analyzeTranscript([], { videoDuration: 600, client })).toEqual([]);
    expect(client.messages.create).not.toHaveBeenCalled();
  });
});
