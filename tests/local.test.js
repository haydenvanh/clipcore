import { describe, it, expect } from "vitest";
import { parseWhisperCppJson, repairSquashedWords } from "../worker/lib/transcribe-local.js";
import { selectMomentsLocally, splitSentences, lengthFit, titleFrom } from "../worker/lib/select-local.js";

/** Words at a steady pace from a sentence list, with a pause between sentences. */
function speak(sentences, { wordSec = 0.35, pauseSec = 0.4, startSec = 0 } = {}) {
  const words = [];
  let t = startSec;
  for (const sentence of sentences) {
    for (const w of sentence.split(" ")) {
      words.push({ w, start: t, end: t + wordSec });
      t += wordSec;
    }
    t += pauseSec;
  }
  return words;
}

describe("parseWhisperCppJson — whisper.cpp output to transcript words", () => {
  const segment = (text, from, to) => ({ text, offsets: { from, to } });

  it("reads one word per segment, in seconds", () => {
    const result = parseWhisperCppJson({
      result: { language: "en" },
      transcription: [segment(" Hello", 0, 400), segment(" world.", 400, 900)],
    });
    expect(result.language).toBe("en");
    expect(result.text).toBe("Hello world.");
    expect(result.words).toEqual([
      { w: "Hello", start: 0, end: 0.4 },
      { w: "world.", start: 0.4, end: 0.9 },
    ]);
  });

  it("skips empty segments and special tokens", () => {
    const result = parseWhisperCppJson({
      result: { language: "en" },
      transcription: [segment("", 0, 30), segment(" [BLANK_AUDIO]", 30, 900), segment(" Hi", 900, 1200)],
    });
    expect(result.words.map((w) => w.w)).toEqual(["Hi"]);
  });

  it("splits a multi-word segment evenly rather than dropping it", () => {
    const result = parseWhisperCppJson({ transcription: [segment(" two words", 0, 1000)] });
    expect(result.words).toEqual([
      { w: "two", start: 0, end: 0.5 },
      { w: "words", start: 0.5, end: 1 },
    ]);
  });

  it("defaults the language when whisper.cpp doesn't report one", () => {
    expect(parseWhisperCppJson({ transcription: [] }).language).toBe("en");
  });
});

describe("repairSquashedWords — no caption flashes by unreadably", () => {
  it("spreads a run stacked onto one instant back into the pause before it", () => {
    // Real whisper.cpp output from "Me at the zoo": three words inside 30 ms.
    const words = [
      { w: "cool.", start: 13.59, end: 14.0 },
      { w: "And", start: 16.0, end: 16.0 },
      { w: "that's", start: 16.0, end: 16.01 },
      { w: "pretty", start: 16.01, end: 16.03 },
      { w: "much", start: 16.03, end: 16.55 },
    ];
    const fixed = repairSquashedWords(words);

    expect(fixed).toHaveLength(5);
    for (const w of fixed) expect(w.end - w.start).toBeGreaterThanOrEqual(0.15);
    // Ordered, contiguous, never overlapping the word before the pause.
    expect(fixed[1].start).toBeGreaterThanOrEqual(14.0);
    for (let i = 1; i < fixed.length; i++) expect(fixed[i].start).toBeGreaterThanOrEqual(fixed[i - 1].end - 1e-9);
    // The anchor word still ends where it was spoken.
    expect(fixed[4].end).toBe(16.55);
  });

  it("leaves normally timed words alone", () => {
    const words = speak(["a normal sentence here."]);
    expect(repairSquashedWords(words)).toEqual(words);
  });

  it("handles a squashed run at the very end", () => {
    const fixed = repairSquashedWords([
      { w: "ok", start: 1, end: 1.4 },
      { w: "bye", start: 3, end: 3.01 },
    ]);
    expect(fixed[1].start).toBeGreaterThanOrEqual(1.4);
    expect(fixed[1].end - fixed[1].start).toBeGreaterThan(0.1);
  });
});

describe("selectMomentsLocally — clips without an AI model", () => {
  it("returns nothing for an empty transcript", () => {
    expect(selectMomentsLocally([], { videoDuration: 60 })).toEqual([]);
  });

  it("starts and ends every clip on a sentence boundary", () => {
    const sentences = Array.from({ length: 40 }, (_, i) =>
      i % 7 === 0 ? `Wait, why does this actually work number ${i}?` : `Here is a plain statement about topic ${i} today.`
    );
    const words = speak(sentences);
    const duration = words[words.length - 1].end;
    const moments = selectMomentsLocally(words, { videoDuration: duration, targetCount: 5 });

    expect(moments.length).toBeGreaterThan(0);
    const starts = new Set(splitSentences(words).map((s) => s[0].start));
    const ends = new Set(splitSentences(words).map((s) => s[s.length - 1].end));
    for (const m of moments) {
      expect([...starts].some((s) => Math.abs(m.startSec - (s - 0.15)) < 0.02 || (s < 0.15 && m.startSec === 0))).toBe(true);
      expect([...ends].some((e) => Math.abs(m.endSec - Math.min(duration, e + 0.3)) < 0.02)).toBe(true);
      expect(m.endSec - m.startSec).toBeLessThanOrEqual(60.5);
    }
  });

  it("never returns overlapping clips and respects the requested count", () => {
    const words = speak(Array.from({ length: 80 }, (_, i) => `Sentence number ${i} says something new.`));
    const moments = selectMomentsLocally(words, { videoDuration: words.at(-1).end, targetCount: 4 });
    expect(moments.length).toBeLessThanOrEqual(4);
    const sorted = [...moments].sort((a, b) => a.startSec - b.startSec);
    for (let i = 1; i < sorted.length; i++) {
      const overlap = sorted[i - 1].endSec - sorted[i].startSec;
      expect(overlap / (sorted[i].endSec - sorted[i].startSec)).toBeLessThanOrEqual(0.2);
    }
  });

  it("prefers the lively stretch over the flat one", () => {
    const flat = Array.from({ length: 12 }, (_, i) => `The report covers item ${i} in the list.`);
    const lively = [
      "Wait, this is insane!",
      "Nobody tells you the secret to this.",
      "Why does it work?",
      "Honestly, I was shocked.",
      "Here's the crazy part, it changed everything!",
      "I love it.",
      "Seriously, stop doing it the old way.",
      "What would you do?",
    ];
    const words = speak([...flat, ...lively, ...flat]);
    const [best] = selectMomentsLocally(words, { videoDuration: words.at(-1).end, targetCount: 3 });
    const livelyStart = words[flat.join(" ").split(" ").length].start;
    const livelyEnd = words[flat.join(" ").split(" ").length + lively.join(" ").split(" ").length - 1].end;
    // The lively part is ~17s, shorter than the ideal clip, so the best clip
    // should contain nearly all of it (plus some context around it).
    const overlap = Math.min(best.endSec, livelyEnd) - Math.max(best.startSec, livelyStart);
    expect(overlap).toBeGreaterThan((livelyEnd - livelyStart) * 0.8);
  });

  it("returns the shape the analyze step stores", () => {
    const words = speak(Array.from({ length: 20 }, (_, i) => `This is line ${i} of the talk.`));
    const [m] = selectMomentsLocally(words, { videoDuration: words.at(-1).end });
    for (const key of ["startSec", "endSec", "title", "hook", "summary", "reasoning", "viralScore", "clipScore", "confidence", "signals"]) {
      expect(m).toHaveProperty(key);
    }
    for (const score of [m.viralScore, m.clipScore, m.confidence]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
    expect(m.reasoning).toMatch(/no AI model/);
  });

  it("still yields a clip from a short video", () => {
    const words = speak(["Alright, so here we are.", "The cool thing is that they have long trunks."]);
    const moments = selectMomentsLocally(words, { videoDuration: words.at(-1).end + 1 });
    expect(moments).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("splits sentences on punctuation and on long pauses", () => {
    const words = [
      { w: "One.", start: 0, end: 0.3 },
      { w: "two", start: 0.4, end: 0.6 },
      { w: "three", start: 2.5, end: 2.8 },
    ];
    expect(splitSentences(words).map((s) => s.map((w) => w.w))).toEqual([["One."], ["two"], ["three"]]);
  });

  it("scores length fit highest in the 25–45 second band", () => {
    expect(lengthFit(30)).toBe(1);
    expect(lengthFit(10)).toBeLessThan(lengthFit(20));
    expect(lengthFit(58)).toBeLessThan(1);
  });

  it("cuts long titles on a word boundary", () => {
    const words = "this is a very long opening sentence that keeps going well past the limit".split(" ")
      .map((w, i) => ({ w, start: i, end: i + 0.5 }));
    const title = titleFrom(words, 30);
    expect(title.length).toBeLessThanOrEqual(31);
    expect(title).toMatch(/^This .*…$/);
    expect(title).not.toMatch(/\s…$/);
  });
});
