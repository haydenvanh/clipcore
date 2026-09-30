import { describe, it, expect, vi, afterEach } from "vitest";
import {
  planChunks, mergeChunkResults, toLanguageCode, transcribeWithRetry, normalizeWords,
} from "../worker/lib/transcribe.js";

describe("planChunks — stays under Whisper's 25 MB upload cap", () => {
  it("splits a long video into ten-minute slices with exact offsets", () => {
    const chunks = planChunks(3600);
    expect(chunks).toHaveLength(6);
    expect(chunks.map((c) => c.startSec)).toEqual([0, 600, 1200, 1800, 2400, 3000]);
    expect(chunks.every((c) => c.durationSec === 600)).toBe(true);
  });

  it("makes the final slice only as long as what's left", () => {
    const chunks = planChunks(1450);
    expect(chunks.map((c) => [c.startSec, c.durationSec])).toEqual([[0, 600], [600, 600], [1200, 250]]);
  });

  it("uses a single slice for a short video", () => {
    expect(planChunks(90)).toEqual([{ index: 0, startSec: 0, durationSec: 90 }]);
  });

  it("still produces one slice when the duration is unknown", () => {
    expect(planChunks(undefined)).toHaveLength(1);
  });

  it("keeps each slice far under the cap at the encoded bitrate", () => {
    // 48 kbps = 6 KB/s. A 600s slice is ~3.6 MB; the cap is 25 MB.
    const bytesPerSlice = 600 * (48_000 / 8);
    expect(bytesPerSlice).toBeLessThan(25 * 1024 * 1024 * 0.2);
  });
});

describe("mergeChunkResults", () => {
  const w = (word, start, end) => ({ w: word, start, end });

  it("shifts each slice onto the source timeline", () => {
    const merged = mergeChunkResults([
      { startSec: 0, result: { language: "en", text: "hello", words: [w("hello", 1, 1.5)] } },
      { startSec: 600, result: { language: "en", text: "world", words: [w("world", 2, 2.5)] } },
    ]);
    expect(merged.words).toEqual([w("hello", 1, 1.5), w("world", 602, 602.5)]);
    expect(merged.text).toBe("hello world");
    expect(merged.language).toBe("en");
  });

  it("orders slices by offset even if they finish out of order", () => {
    const merged = mergeChunkResults([
      { startSec: 600, result: { text: "second", words: [w("second", 0, 1)] } },
      { startSec: 0, result: { text: "first", words: [w("first", 0, 1)] } },
    ]);
    expect(merged.words.map((x) => x.w)).toEqual(["first", "second"]);
    expect(merged.text).toBe("first second");
  });

  it("drops a word duplicated across a slice boundary", () => {
    const merged = mergeChunkResults([
      { startSec: 0, result: { words: [w("edge", 599.6, 600.2)] } },
      { startSec: 600, result: { words: [w("edge", -0.3, 0.2)] } },
    ]);
    expect(merged.words.filter((x) => x.w === "edge")).toHaveLength(1);
  });

  it("keeps two different words that merely touch", () => {
    const merged = mergeChunkResults([
      { startSec: 0, result: { words: [w("one", 0, 1), w("two", 1, 2)] } },
    ]);
    expect(merged.words).toHaveLength(2);
  });

  it("survives an empty slice (silence)", () => {
    const merged = mergeChunkResults([
      { startSec: 0, result: { language: "en", text: "", words: [] } },
      { startSec: 600, result: { text: "hi", words: [w("hi", 0, 1)] } },
    ]);
    expect(merged.words).toHaveLength(1);
    expect(merged.text).toBe("hi");
  });
});

describe("toLanguageCode — Whisper reports names but only accepts codes", () => {
  it.each([
    ["english", "en"], ["English", "en"], ["spanish", "es"], ["japanese", "ja"],
    ["en", "en"], ["klingon", null], [null, null], ["", null],
  ])("%s → %s", (input, expected) => {
    expect(toLanguageCode(input)).toBe(expected);
  });
});

describe("normalizeWords", () => {
  it("reads word-level timings and drops empty or zero-length words", () => {
    const words = normalizeWords({
      words: [
        { word: " Hello", start: 0, end: 0.4 },
        { word: "", start: 0.4, end: 0.5 },
        { word: "x", start: 1, end: 1 },
      ],
    });
    expect(words).toEqual([{ w: "Hello", start: 0, end: 0.4 }]);
  });

  it("falls back to spreading segment time across its words", () => {
    const words = normalizeWords({ segments: [{ text: "a b", start: 0, end: 2 }] });
    expect(words).toEqual([
      { w: "a", start: 0, end: 1 },
      { w: "b", start: 1, end: 2 },
    ]);
  });
});

describe("transcribeWithRetry", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not retry a 401 — a bad key only delays the error", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unauthorized", { status: 401 })
    );
    const { transcribeWithRetry: retry } = await import("../worker/lib/transcribe.js?retry401");
    await expect(retry("/dev/null", {}, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow(/401/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("is exported", () => {
    expect(typeof transcribeWithRetry).toBe("function");
  });
});
