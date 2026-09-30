/**
 * Caption rendering: word-level timings -> Advanced SubStation Alpha (.ass).
 *
 * ASS rather than SRT because SRT has no styling and no intra-line timing, so
 * karaoke and word-by-word are impossible in it. ffmpeg burns ASS in with the
 * `subtitles` filter, which is why every style below is one file format.
 *
 * ASS colours are &HAABBGGRR — alpha first, then blue, green, red. That byte
 * order is backwards from CSS and is the usual source of "why is my yellow
 * blue" bugs, so build them with assColor() rather than by hand.
 */

/** Seconds -> H:MM:SS.CC (ASS uses centiseconds, and exactly two digits). */
export function assTime(seconds) {
  const clamped = Math.max(0, seconds);
  const totalCs = Math.round(clamped * 100);
  const cs = totalCs % 100;
  const totalSeconds = (totalCs - cs) / 100;
  const s = totalSeconds % 60;
  const totalMinutes = (totalSeconds - s) / 60;
  const m = totalMinutes % 60;
  const h = (totalMinutes - m) / 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}

/** "#RRGGBB" -> "&HAABBGGRR". alpha 0 = opaque, 255 = transparent. */
export function assColor(hex, alpha = 0) {
  const clean = hex.replace("#", "").trim();
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  const a = alpha.toString(16).padStart(2, "0");
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

/**
 * Text that appears inside a Dialogue line must not contain a raw newline or
 * an unescaped brace, or the renderer reads it as an override block.
 */
export function escapeAssText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

/**
 * Where a caption block sits, mapped to ASS alignment codes.
 * 1-3 bottom, 4-6 middle, 7-9 top; the middle digit is centred.
 */
export const POSITIONS = { bottom: 2, center: 5, top: 8 };

/** Fonts guaranteed present in the worker image (see worker/Dockerfile). */
export const FONTS = {
  "Arial Black": "Arial Black",
  Arial: "Arial",
  Impact: "Impact",
  "DejaVu Sans": "DejaVu Sans",
  "DejaVu Sans Bold": "DejaVu Sans Bold",
  Verdana: "Verdana",
};

export const CAPTION_PRESETS = {
  KARAOKE: {
    fontName: "Arial Black",
    fontSize: 86,
    primary: "#FFE81F",   // colour a word turns as it is spoken
    secondary: "#FFFFFF", // colour before it is spoken
    outline: "#000000",
    outlineWidth: 6,
    shadow: 0,
    marginV: 260,
    maxWordsPerLine: 5,
    uppercase: true,
  },
  WORD_BY_WORD: {
    fontName: "Arial Black",
    fontSize: 104,
    primary: "#FFFFFF",
    secondary: "#FFFFFF",
    outline: "#000000",
    outlineWidth: 7,
    shadow: 0,
    marginV: 300,
    maxWordsPerLine: 1,
    uppercase: true,
  },
  ANIMATED: {
    fontName: "Arial Black",
    fontSize: 88,
    primary: "#FFFFFF",
    secondary: "#FFFFFF",
    outline: "#000000",
    outlineWidth: 6,
    shadow: 0,
    marginV: 260,
    maxWordsPerLine: 4,
    uppercase: true,
    // A short scale-up as each line appears. \fscx/\fscy are percentages.
    entryEffect: "{\\fad(80,80)\\t(0,120,\\fscx110\\fscy110)\\t(120,220,\\fscx100\\fscy100)}",
  },
  /**
   * The look most short-form creators actually ask for: a few big words with a
   * solid box behind them, so they stay readable over any footage.
   */
  TIKTOK: {
    fontName: "Arial Black",
    fontSize: 92,
    primary: "#FFFFFF",
    secondary: "#FFFFFF",
    outline: "#000000",
    outlineWidth: 0,
    shadow: 0,
    marginV: 280,
    maxWordsPerLine: 3,
    uppercase: true,
    // BorderStyle 3 draws an opaque box using backColour instead of an outline.
    boxed: true,
    backColour: "#000000",
    backAlpha: 40,
  },

  STATIC: {
    fontName: "Arial",
    fontSize: 72,
    primary: "#FFFFFF",
    secondary: "#FFFFFF",
    outline: "#000000",
    outlineWidth: 4,
    shadow: 1,
    marginV: 220,
    maxWordsPerLine: 7,
    uppercase: false,
  },
};

/**
 * Merge a preset with user customization.
 *
 * Every field is validated and clamped: these values are written straight into
 * an ASS header, and an unvalidated string there can break the whole filter
 * graph or inject style overrides.
 */
export function resolveStyle(styleName, overrides = {}) {
  const preset = CAPTION_PRESETS[styleName] ?? CAPTION_PRESETS.KARAOKE;
  const custom = overrides ?? {};

  const hex = (value, fallback) =>
    typeof value === "string" && /^#?[0-9a-f]{6}$/i.test(value.trim())
      ? (value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`)
      : fallback;

  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };

  return {
    ...preset,
    // Only fonts we ship can be honoured; anything else silently renders as a
    // fallback face and looks broken.
    fontName: FONTS[custom.fontName] ?? preset.fontName,
    fontSize: clamp(custom.fontSize, 24, 200, preset.fontSize),
    primary: hex(custom.primary, preset.primary),
    secondary: hex(custom.secondary, preset.secondary),
    outline: hex(custom.outline, preset.outline),
    outlineWidth: clamp(custom.outlineWidth, 0, 20, preset.outlineWidth),
    marginV: clamp(custom.marginV, 0, 800, preset.marginV),
    alignment: POSITIONS[custom.position] ?? POSITIONS.bottom,
    boxed: custom.background === true ? true : custom.background === false ? false : Boolean(preset.boxed),
    backColour: hex(custom.backColour, preset.backColour ?? "#000000"),
    backAlpha: clamp(custom.backAlpha, 0, 255, preset.backAlpha ?? 128),
    uppercase: typeof custom.uppercase === "boolean" ? custom.uppercase : preset.uppercase,
    maxWordsPerLine: clamp(custom.maxWordsPerLine, 1, 12, preset.maxWordsPerLine),
  };
}

/** Video pixel dimensions per aspect ratio, used as the ASS canvas. */
export const RESOLUTIONS = {
  RATIO_9_16: { width: 1080, height: 1920 },
  RATIO_1_1: { width: 1080, height: 1080 },
  RATIO_16_9: { width: 1920, height: 1080 },
};

function header(preset, { width, height }) {
  // BorderStyle 3 fills an opaque box behind the text using backColour;
  // BorderStyle 1 draws an outline and drop shadow instead.
  const borderStyle = preset.boxed ? 3 : 1;
  const backColour = preset.boxed
    ? assColor(preset.backColour ?? "#000000", preset.backAlpha ?? 128)
    : assColor("#000000", 128);
  const alignment = preset.alignment ?? 2;

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    // Smart wrapping, lines broken evenly. Events are sized to fit in at most
    // two lines (see lineCharBudget); with no wrapping at all a long line runs
    // off both edges of a vertical frame instead.
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    [
      "Style: Default",
      preset.fontName,
      preset.fontSize,
      assColor(preset.primary),
      assColor(preset.secondary),
      assColor(preset.outline),
      backColour,
      "-1", "0", "0", "0",
      "100", "100", "0", "0",
      borderStyle,
      preset.outlineWidth,
      preset.shadow,
      alignment,
      SIDE_MARGIN, SIDE_MARGIN,
      preset.marginV,
      "1",
    ].join(","),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");
}

/** Horizontal margin on each side of the caption, in canvas pixels. */
const SIDE_MARGIN = 80;

/**
 * How many characters fit across one caption line.
 *
 * An estimate from average glyph width — heavy uppercase faces like Arial
 * Black run ~0.78em a character, mixed case ~0.55em — erring narrow, since
 * libass wraps anything that still doesn't fit.
 */
export function lineCharBudget(preset, { width }) {
  const usable = width - 2 * SIDE_MARGIN - 2 * (preset.outlineWidth ?? 0);
  const perChar = preset.fontSize * (preset.uppercase ? 0.78 : 0.55);
  return Math.max(6, Math.floor(usable / perChar));
}

/**
 * Group words into caption lines.
 *
 * Splits on the word budget and the character budget, but also on a pause
 * longer than `maxGap` — a caption that spans a two-second silence reads as
 * though the speaker never stopped, which is the most common way auto-captions
 * feel wrong.
 */
export function groupWords(words, { maxWordsPerLine = 5, maxChars = Infinity, maxGap = 0.7, maxDuration = 4 } = {}) {
  const lines = [];
  let current = [];
  let chars = 0;

  for (const word of words) {
    const length = String(word.w).length;
    if (current.length > 0) {
      const previous = current[current.length - 1];
      const gap = word.start - previous.end;
      const duration = word.end - current[0].start;

      if (
        current.length >= maxWordsPerLine ||
        chars + 1 + length > maxChars ||
        gap > maxGap ||
        duration > maxDuration
      ) {
        lines.push(current);
        current = [];
        chars = 0;
      }
    }
    chars += (current.length > 0 ? 1 : 0) + length;
    current.push(word);
  }

  if (current.length > 0) lines.push(current);
  return lines;
}

/**
 * Build an .ass file for one clip.
 *
 * @param {Array<{w:string,start:number,end:number}>} words absolute-time words
 * @param {object} options
 * @param {number} options.clipStart clip start in the source, subtracted so
 *   caption times are relative to the trimmed clip
 */
export function buildAss(words, {
  style = "KARAOKE",
  aspectRatio = "RATIO_9_16",
  clipStart = 0,
  clipEnd = Infinity,
  customization = {},
} = {}) {
  const preset = resolveStyle(style, customization);
  const resolution = RESOLUTIONS[aspectRatio] ?? RESOLUTIONS.RATIO_9_16;

  // Keep words that overlap the clip at all, then rebase onto clip time.
  const windowed = words
    .filter((w) => w.end > clipStart && w.start < clipEnd)
    .map((w) => ({
      w: preset.uppercase ? String(w.w).toUpperCase() : String(w.w),
      start: Math.max(0, w.start - clipStart),
      end: Math.max(0, Math.min(w.end, clipEnd) - clipStart),
    }))
    .filter((w) => w.end > w.start);

  const lines = groupWords(windowed, {
    maxWordsPerLine: preset.maxWordsPerLine,
    // At most two lines on screen at once.
    maxChars: 2 * lineCharBudget(preset, resolution),
  });

  const events = lines.map((line) => {
    const start = line[0].start;
    const end = line[line.length - 1].end;
    const prefix = preset.entryEffect ?? "";

    let text;
    if (style === "KARAOKE" || style === "TIKTOK") {
      // \k takes centiseconds and fills each word in turn, so the line is
      // visible whole while the highlight tracks the speaker.
      text = line
        .map((word) => {
          const cs = Math.max(1, Math.round((word.end - word.start) * 100));
          return `{\\k${cs}}${escapeAssText(word.w)}`;
        })
        .join(" ");
    } else {
      text = line.map((word) => escapeAssText(word.w)).join(" ");
    }

    return `Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${prefix}${text}`;
  });

  return `${header(preset, resolution)}\n${events.join("\n")}\n`;
}

/** SRT export, for users who want to edit captions elsewhere. */
export function buildSrt(words, { clipStart = 0, clipEnd = Infinity, maxWordsPerLine = 7 } = {}) {
  const windowed = words
    .filter((w) => w.end > clipStart && w.start < clipEnd)
    .map((w) => ({
      w: String(w.w),
      start: Math.max(0, w.start - clipStart),
      end: Math.max(0, Math.min(w.end, clipEnd) - clipStart),
    }))
    .filter((w) => w.end > w.start);

  const srtTime = (seconds) => {
    const ms = Math.round(seconds * 1000);
    const pad = (n, len = 2) => String(n).padStart(len, "0");
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(
      Math.floor(ms / 1000) % 60
    )},${pad(ms % 1000, 3)}`;
  };

  return groupWords(windowed, { maxWordsPerLine })
    .map((line, index) => {
      const text = line.map((w) => w.w).join(" ");
      return `${index + 1}\n${srtTime(line[0].start)} --> ${srtTime(line[line.length - 1].end)}\n${text}\n`;
    })
    .join("\n");
}

/**
 * WebVTT export.
 *
 * Same cues as SRT, different time punctuation and a WEBVTT header. Browsers
 * take VTT natively via <track>, which is what makes an in-page caption
 * preview possible without burning anything in.
 */
export function buildVtt(words, { clipStart = 0, clipEnd = Infinity, maxWordsPerLine = 7 } = {}) {
  const windowed = words
    .filter((w) => w.end > clipStart && w.start < clipEnd)
    .map((w) => ({
      w: String(w.w),
      start: Math.max(0, w.start - clipStart),
      end: Math.max(0, Math.min(w.end, clipEnd) - clipStart),
    }))
    .filter((w) => w.end > w.start);

  const vttTime = (seconds) => {
    const ms = Math.round(seconds * 1000);
    const pad = (n, len = 2) => String(n).padStart(len, "0");
    // VTT uses a dot before milliseconds where SRT uses a comma.
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(
      Math.floor(ms / 1000) % 60
    )}.${pad(ms % 1000, 3)}`;
  };

  const cues = groupWords(windowed, { maxWordsPerLine }).map((line, index) => {
    const text = line.map((w) => w.w).join(" ");
    return `${index + 1}\n${vttTime(line[0].start)} --> ${vttTime(line[line.length - 1].end)}\n${text}\n`;
  });

  return `WEBVTT\n\n${cues.join("\n")}`;
}

/** Every caption format we can emit, for the download UI. */
export const CAPTION_FORMATS = {
  srt: { extension: "srt", contentType: "application/x-subrip", build: buildSrt },
  vtt: { extension: "vtt", contentType: "text/vtt", build: buildVtt },
  ass: { extension: "ass", contentType: "text/plain", build: buildAss },
};
