import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/services/credits", () => ({ CreditService: {} }));

const { AIService } = await import("@/lib/services/ai");

describe("normalizeHighlights", () => {
  it("clamps to the 1..60 range the UI advertises", () => {
    expect(AIService.normalizeHighlights(0)).toBe(1);
    expect(AIService.normalizeHighlights(-5)).toBe(1);
    expect(AIService.normalizeHighlights(9999)).toBe(60);
    expect(AIService.normalizeHighlights(12)).toBe(12);
  });

  it("survives non-numeric input instead of producing NaN", () => {
    expect(AIService.normalizeHighlights("abc")).toBe(3);
    expect(AIService.normalizeHighlights(undefined)).toBe(3);
    expect(AIService.normalizeHighlights(null)).toBe(3);
  });
});

describe("extractMediaUrls", () => {
  it("reads every payload shape the provider returns", () => {
    expect(AIService.extractMediaUrls({ outputs: ["a", "b"] })).toEqual(["a", "b"]);
    expect(AIService.extractMediaUrls({ url: "a" })).toEqual(["a"]);
    expect(AIService.extractMediaUrls({ video_url: "a" })).toEqual(["a"]);
    expect(AIService.extractMediaUrls({ download_url: "a" })).toEqual(["a"]);
    expect(AIService.extractMediaUrls({})).toEqual([]);
  });
});

describe("parseResultUrls", () => {
  it("handles JSON arrays, bare strings, and null", () => {
    expect(AIService.parseResultUrls('["a","b"]')).toEqual(["a", "b"]);
    expect(AIService.parseResultUrls("https://x/y.mp4")).toEqual(["https://x/y.mp4"]);
    expect(AIService.parseResultUrls(null)).toEqual([]);
  });
});

describe("calculateClippingCost", () => {
  it("refuses a private address before making any request", async () => {
    await expect(
      AIService.calculateClippingCost("http://169.254.169.254/", 3)
    ).rejects.toThrow();
  });

  it("prices a non-YouTube URL from the nominal duration", async () => {
    const result = await AIService.calculateClippingCost("https://cdn.example/x.mp4", 3);
    // 5 min * 0.05 + 3 * 0.05 = 0.40 -> 80 credits
    expect(result.cost).toBe(80);
    expect(result.estimated).toBe(true);
  });

  it("clamps the highlight count before it reaches pricing", async () => {
    const result = await AIService.calculateClippingCost("https://cdn.example/x.mp4", 10_000);
    // 5 min * 0.05 + 60 * 0.05 = 3.25 -> 650 credits
    expect(result.cost).toBe(650);
  });
});

describe("checkStatus", () => {
  it("refuses to run without a userId, which is what closed the IDOR", async () => {
    await expect(AIService.checkStatus("req_123")).rejects.toThrow(/userId/);
  });
});
