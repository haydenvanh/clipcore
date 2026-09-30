import { describe, it, expect } from "vitest";
import { parseRange } from "@/lib/range";

describe("parseRange", () => {
  const size = 1000;

  it("returns null when there is no Range header", () => {
    expect(parseRange(null, size)).toBeNull();
    expect(parseRange("", size)).toBeNull();
  });

  it.each([
    ["bytes=0-99", { start: 0, end: 99 }],
    ["bytes=500-", { start: 500, end: 999 }],
    ["bytes=-100", { start: 900, end: 999 }],
    ["bytes=0-5000", { start: 0, end: 999 }], // end clamped to the file
    ["bytes=999-999", { start: 999, end: 999 }],
  ])("parses %s", (header, expected) => {
    expect(parseRange(header, size)).toEqual(expected);
  });

  it("clamps an oversized suffix to the whole file", () => {
    expect(parseRange("bytes=-5000", size)).toEqual({ start: 0, end: 999 });
  });

  it.each([
    ["start past the end", "bytes=1000-"],
    ["start after end", "bytes=50-10"],
    ["empty bounds", "bytes=-"],
    ["zero-length suffix", "bytes=-0"],
    ["wrong unit", "items=0-10"],
    ["multi-range", "bytes=0-10,20-30"],
    ["garbage", "nonsense"],
  ])("rejects %s as unsatisfiable", (_name, header) => {
    expect(parseRange(header, size)).toEqual({ invalid: true });
  });
});
