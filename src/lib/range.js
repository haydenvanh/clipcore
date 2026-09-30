/**
 * Parse a single-range `Range: bytes=…` header.
 *
 * Handles `start-end`, `start-` and the suffix form `-n`. Returns null when
 * there is no range, or { invalid: true } for one that cannot be satisfied.
 * Multi-range requests are treated as invalid; browsers never send them for
 * media, and serving multipart/byteranges is not worth the complexity here.
 */
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match) return { invalid: true };

  const [, rawStart, rawEnd] = match;
  let start;
  let end;

  if (rawStart === "" && rawEnd === "") return { invalid: true };
  if (rawStart === "") {
    const length = Number(rawEnd);
    if (length === 0) return { invalid: true };
    start = Math.max(0, size - length);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return { invalid: true };
  }
  return { start, end };
}
