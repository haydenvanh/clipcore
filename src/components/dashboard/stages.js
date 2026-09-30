/**
 * Pipeline stages in the order the worker runs them, shared by the list and
 * the video page so both describe progress the same way.
 */
export const STAGES = {
  PENDING: { label: "Queued", step: 0 },
  EXTRACTING: { label: "Downloading video", step: 1 },
  TRANSCRIBING: { label: "Transcribing audio", step: 2 },
  ANALYZING: { label: "Finding the best moments", step: 3 },
  RENDERING: { label: "Rendering clips", step: 4 },
  COMPLETED: { label: "Done", step: 5 },
  FAILED: { label: "Failed", step: -1 },
  CANCELED: { label: "Canceled", step: -1 },
};

export const TOTAL_STEPS = 5;

export const isWorking = (status) => !["COMPLETED", "FAILED", "CANCELED"].includes(status);

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function relativeTime(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
