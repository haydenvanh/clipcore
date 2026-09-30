/**
 * Where to resume a video, based on what already exists.
 *
 * Each pipeline stage writes durable output before the next one starts, so the
 * first missing output is exactly where the work stopped.
 *
 * @returns {"extract"|"transcribe"|"analyze"|"render"|null}
 */
export function resumePoint(video) {
  if (!video.storageKey) return "extract";
  if (!video.transcript) return "transcribe";
  if (!video.clips || video.clips.length === 0) return "analyze";
  const failed = video.clips.flatMap((clip) => clip.renders ?? []).filter((r) => r.status === "FAILED");
  if (failed.length > 0) return "render";
  return null;
}
