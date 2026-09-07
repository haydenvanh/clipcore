/**
 * Caption generation, re-exported for the Next.js app.
 *
 * The implementation lives in worker/lib/captions.js because the worker is
 * where captions are actually burned in. Both runtimes must produce byte-identical
 * output — a sidecar .srt that disagrees with the burned-in captions is a bug
 * report waiting to happen — so there is one implementation, not two.
 */
export {
  assTime, assColor, escapeAssText, groupWords,
  buildAss, buildSrt, buildVtt, resolveStyle,
  CAPTION_PRESETS, CAPTION_FORMATS, RESOLUTIONS, POSITIONS, FONTS,
} from "../../worker/lib/captions.js";
