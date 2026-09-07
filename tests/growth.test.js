import { describe, it, expect } from "vitest";
import {
  buildGrowthReport, explainScore, estimateRetention,
  recommendPlatforms, growthSuggestions,
} from "../worker/lib/growth.js";

const strongSignals = { hook: 82, emotion: 71, speechIntensity: 66, reactions: 55, questions: 48 };
const weakSignals = { hook: 12, emotion: 9, speechIntensity: 21, reactions: 3, questions: 5 };

describe("explainScore", () => {
  it("marks criteria met for a strong clip and unmet for a weak one", () => {
    expect(explainScore(strongSignals).every((r) => r.met)).toBe(true);
    expect(explainScore(weakSignals).some((r) => r.met)).toBe(false);
  });

  it("reports the underlying strength, so the number is traceable", () => {
    const hook = explainScore(strongSignals).find((r) => r.label === "Strong hook");
    expect(hook.strength).toBe(82);
  });

  it("survives a clip with no stored signals", () => {
    const reasons = explainScore(undefined);
    expect(reasons).toHaveLength(5);
    expect(reasons.every((r) => r.met === false)).toBe(true);
  });
});

describe("estimateRetention", () => {
  it("is always flagged as an estimate, never a measurement", () => {
    expect(estimateRetention({ signals: strongSignals, durationSec: 40 }).estimated).toBe(true);
  });

  it("returns intro, middle and payoff, all within 0-100", () => {
    const r = estimateRetention({ signals: strongSignals, durationSec: 40 });
    expect(r.points.map((p) => p.label)).toEqual(["Intro", "Middle", "Payoff"]);
    for (const p of r.points) {
      expect(p.value).toBeGreaterThanOrEqual(0);
      expect(p.value).toBeLessThanOrEqual(100);
    }
  });

  it("declines monotonically across the clip", () => {
    const [intro, middle, payoff] = estimateRetention({
      signals: strongSignals, durationSec: 45,
    }).points.map((p) => p.value);
    expect(intro).toBeGreaterThanOrEqual(middle);
    expect(middle).toBeGreaterThanOrEqual(payoff);
  });

  it("rates a strong hook above a weak one", () => {
    const strong = estimateRetention({ signals: strongSignals, durationSec: 40 }).overall;
    const weak = estimateRetention({ signals: weakSignals, durationSec: 40 }).overall;
    expect(strong).toBeGreaterThan(weak);
  });

  it("penalises a clip that runs long", () => {
    const short = estimateRetention({ signals: strongSignals, durationSec: 40 }).overall;
    const long = estimateRetention({ signals: strongSignals, durationSec: 180 }).overall;
    expect(long).toBeLessThan(short);
  });

  it("flags a late payoff as a drop-off point", () => {
    const r = estimateRetention({ signals: weakSignals, durationSec: 200 });
    expect(r.drops.length).toBeGreaterThan(0);
  });
});

describe("recommendPlatforms", () => {
  it("ranks all four by confidence, highest first", () => {
    const ranked = recommendPlatforms({ durationSec: 40, aspectRatio: "RATIO_9_16", viralScore: 90 });
    expect(ranked).toHaveLength(4);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].confidence).toBeGreaterThanOrEqual(ranked[i].confidence);
    }
  });

  it("demotes platforms that cannot take the aspect ratio", () => {
    // Only YouTube accepts 16:9 among these.
    const ranked = recommendPlatforms({ durationSec: 40, aspectRatio: "RATIO_16_9", viralScore: 90 });
    expect(ranked[0].id).toBe("YOUTUBE");
    expect(ranked.find((p) => p.id === "TIKTOK").compatible).toBe(false);
  });

  it("marks a clip past a platform's hard limit as incompatible", () => {
    const ranked = recommendPlatforms({ durationSec: 300, aspectRatio: "RATIO_9_16", viralScore: 80 });
    expect(ranked.find((p) => p.id === "YOUTUBE").compatible).toBe(false); // Shorts caps at 180s
    expect(ranked.find((p) => p.id === "FACEBOOK").compatible).toBe(true);
  });

  it("keeps confidence within 0-100", () => {
    for (const duration of [1, 40, 5000]) {
      for (const p of recommendPlatforms({ durationSec: duration, viralScore: 100 })) {
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("growthSuggestions", () => {
  it("names a measurement and an action, never generic advice", () => {
    const suggestions = growthSuggestions({ signals: weakSignals, durationSec: 120 });
    expect(suggestions.length).toBeGreaterThan(0);
    // Every suggestion should be specific enough to contain a number or a noun
    // the user can act on, not "improve your hook".
    expect(suggestions.some((s) => /\d/.test(s.text))).toBe(true);
  });

  it("suggests moving the payoff for an over-long clip", () => {
    const suggestions = growthSuggestions({ signals: strongSignals, durationSec: 150 });
    expect(suggestions.some((s) => s.id === "move-payoff")).toBe(true);
  });

  it("says nothing about length for a well-sized clip", () => {
    const suggestions = growthSuggestions({ signals: strongSignals, durationSec: 40 });
    expect(suggestions.some((s) => s.id === "move-payoff")).toBe(false);
  });

  it("caps the list so the panel stays readable", () => {
    expect(growthSuggestions({ signals: weakSignals, durationSec: 300 }).length).toBeLessThanOrEqual(5);
  });
});

describe("buildGrowthReport", () => {
  const clip = {
    viralScore: 91.4, clipScore: 84, confidence: 77,
    startSec: 10, endSec: 52, aspectRatio: "RATIO_9_16",
    signals: strongSignals, reasoning: "Opens on a concrete admission.",
  };

  it("assembles every section the panel renders", () => {
    const r = buildGrowthReport(clip);
    expect(r).toMatchObject({ viralScore: 91, clipScore: 84, confidence: 77, hookStrength: 82 });
    expect(r.reasons).toHaveLength(5);
    expect(r.platforms).toHaveLength(4);
    expect(r.retention.estimated).toBe(true);
    expect(r.reasoning).toBe("Opens on a concrete admission.");
    expect(r.durationSec).toBe(42);
  });

  it("does not throw on a clip that has not been scored yet", () => {
    const r = buildGrowthReport({});
    expect(r.viralScore).toBe(0);
    expect(Number.isFinite(r.retention.overall)).toBe(true);
    expect(r.platforms).toHaveLength(4);
  });

  it("handles a null clip entirely", () => {
    expect(() => buildGrowthReport(null)).not.toThrow();
  });
});
