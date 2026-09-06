import { describe, it, expect } from "vitest";
import {
  assTime, assColor, escapeAssText, groupWords, buildAss, buildSrt,
  CAPTION_PRESETS, RESOLUTIONS,
} from "../worker/lib/captions.js";

const WORDS = [
  { w: "the", start: 10.0, end: 10.2 },
  { w: "thing", start: 10.2, end: 10.5 },
  { w: "nobody", start: 10.5, end: 11.0 },
  { w: "tells", start: 11.0, end: 11.3 },
  { w: "you", start: 11.3, end: 11.5 },
  // a 1.5s pause — a caption should break here even though the budget allows more
  { w: "is", start: 13.0, end: 13.2 },
  { w: "this", start: 13.2, end: 13.5 },
];

describe("assTime", () => {
  it.each([
    [0, "0:00:00.00"],
    [1.5, "0:00:01.50"],
    [61.23, "0:01:01.23"],
    [3661.5, "1:01:01.50"],
    [-4, "0:00:00.00"],
  ])("formats %s as %s", (input, expected) => {
    expect(assTime(input)).toBe(expected);
  });

  it("rolls centiseconds into seconds instead of emitting .100", () => {
    expect(assTime(1.999)).toBe("0:00:02.00");
  });
});

describe("assColor", () => {
  it("emits &HAABBGGRR — byte order reversed from CSS", () => {
    expect(assColor("#FFE81F")).toBe("&H001FE8FF");
    expect(assColor("#000000")).toBe("&H00000000");
    expect(assColor("#FFFFFF")).toBe("&H00FFFFFF");
  });

  it("puts alpha in the high byte, where 0 is opaque", () => {
    expect(assColor("#000000", 128)).toBe("&H80000000");
  });
});

describe("escapeAssText", () => {
  it("neutralises braces so text is not parsed as an override block", () => {
    expect(escapeAssText("{\\an8}hack")).toBe("\\{\\\\an8\\}hack");
  });

  it("converts newlines to the ASS line break", () => {
    expect(escapeAssText("a\nb")).toBe("a\\Nb");
  });
});

describe("groupWords", () => {
  it("breaks on a long pause, not only on the word budget", () => {
    const lines = groupWords(WORDS, { maxWordsPerLine: 10, maxGap: 0.7 });
    expect(lines).toHaveLength(2);
    expect(lines[0].map((w) => w.w)).toEqual(["the", "thing", "nobody", "tells", "you"]);
    expect(lines[1].map((w) => w.w)).toEqual(["is", "this"]);
  });

  it("respects the word budget", () => {
    const lines = groupWords(WORDS, { maxWordsPerLine: 2, maxGap: 99 });
    expect(lines.every((l) => l.length <= 2)).toBe(true);
  });

  it("returns nothing for no words", () => {
    expect(groupWords([])).toEqual([]);
  });
});

describe("buildAss", () => {
  it("writes a canvas matching the requested aspect ratio", () => {
    const ass = buildAss(WORDS, { aspectRatio: "RATIO_9_16", clipStart: 10 });
    expect(ass).toContain(`PlayResX: ${RESOLUTIONS.RATIO_9_16.width}`);
    expect(ass).toContain(`PlayResY: ${RESOLUTIONS.RATIO_9_16.height}`);

    const square = buildAss(WORDS, { aspectRatio: "RATIO_1_1", clipStart: 10 });
    expect(square).toContain("PlayResX: 1080");
    expect(square).toContain("PlayResY: 1080");
  });

  it("rebases timings onto the clip, so a clip at 10s starts at 0", () => {
    const ass = buildAss(WORDS, { clipStart: 10, clipEnd: 14 });
    expect(ass).toContain("Dialogue: 0,0:00:00.00,");
    expect(ass).not.toMatch(/Dialogue: 0,0:00:1[0-9]/);
  });

  it("emits \\k karaoke tags whose centiseconds match each word's duration", () => {
    const ass = buildAss([{ w: "hello", start: 0, end: 0.5 }], { style: "KARAOKE" });
    expect(ass).toContain("{\\k50}HELLO");
  });

  it("never emits \\k0, which would make a word flash by unrendered", () => {
    const ass = buildAss([{ w: "a", start: 0, end: 0.001 }], { style: "KARAOKE" });
    expect(ass).toContain("{\\k1}A");
    expect(ass).not.toContain("{\\k0}");
  });

  it("puts one word per line in WORD_BY_WORD", () => {
    const ass = buildAss(WORDS, { style: "WORD_BY_WORD", clipStart: 10 });
    const dialogues = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
    expect(dialogues).toHaveLength(WORDS.length);
  });

  it("applies the entry animation only in ANIMATED", () => {
    expect(buildAss(WORDS, { style: "ANIMATED", clipStart: 10 })).toContain("\\fad(80,80)");
    expect(buildAss(WORDS, { style: "STATIC", clipStart: 10 })).not.toContain("\\fad");
  });

  it("keeps original casing in STATIC and uppercases in KARAOKE", () => {
    expect(buildAss([{ w: "Hello", start: 0, end: 1 }], { style: "STATIC" })).toContain("Hello");
    expect(buildAss([{ w: "Hello", start: 0, end: 1 }], { style: "KARAOKE" })).toContain("HELLO");
  });

  it("drops words outside the clip window and clamps one that straddles the end", () => {
    const ass = buildAss(WORDS, { clipStart: 10, clipEnd: 11.2 });
    expect(ass).toContain("THE");
    expect(ass).not.toContain("THIS"); // starts at 13.2, well past clipEnd
  });

  it("produces a valid, complete file even with no words", () => {
    const ass = buildAss([], {});
    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("[V4+ Styles]");
    expect(ass).toContain("[Events]");
    expect(ass.split("\n").filter((l) => l.startsWith("Dialogue:"))).toHaveLength(0);
  });

  it("declares the style's colours in the header", () => {
    const ass = buildAss(WORDS, { style: "KARAOKE", clipStart: 10 });
    expect(ass).toContain(assColor(CAPTION_PRESETS.KARAOKE.primary));
    expect(ass).toContain(assColor(CAPTION_PRESETS.KARAOKE.secondary));
  });

  it("orders every Dialogue line by start time", () => {
    const ass = buildAss(WORDS, { clipStart: 10 });
    const starts = ass.split("\n").filter((l) => l.startsWith("Dialogue:")).map((l) => l.split(",")[1]);
    expect([...starts]).toEqual([...starts].sort());
  });
});

describe("buildSrt", () => {
  it("emits numbered cues with comma-separated milliseconds", () => {
    const srt = buildSrt(WORDS, { clipStart: 10 });
    expect(srt).toMatch(/^1\n00:00:00,000 --> /);
    expect(srt).toContain("the thing nobody tells you");
  });
});
