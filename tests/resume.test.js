import { describe, it, expect } from "vitest";
import { resumePoint } from "@/lib/resume";

const clip = (...statuses) => ({ renders: statuses.map((status) => ({ status })) });

describe("resumePoint — retry from the first stage that didn't finish", () => {
  it("re-extracts when the source never made it to storage", () => {
    expect(resumePoint({ storageKey: null, transcript: null, clips: [] })).toBe("extract");
  });

  it("re-transcribes when the source exists but there is no transcript", () => {
    expect(resumePoint({ storageKey: "s", transcript: null, clips: [] })).toBe("transcribe");
  });

  it("re-analyzes when transcribed but no clips were chosen", () => {
    expect(resumePoint({ storageKey: "s", transcript: { id: "t" }, clips: [] })).toBe("analyze");
  });

  it("re-renders only when some renders failed — not the whole pipeline", () => {
    expect(
      resumePoint({ storageKey: "s", transcript: { id: "t" }, clips: [clip("COMPLETED"), clip("FAILED")] })
    ).toBe("render");
  });

  it("has nothing to do when every render completed", () => {
    expect(
      resumePoint({ storageKey: "s", transcript: { id: "t" }, clips: [clip("COMPLETED"), clip("COMPLETED")] })
    ).toBeNull();
  });

  it("tolerates clips loaded without their renders", () => {
    expect(resumePoint({ storageKey: "s", transcript: { id: "t" }, clips: [{}] })).toBeNull();
  });
});
