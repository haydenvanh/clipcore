#!/usr/bin/env node
/**
 * Render the brand kit.
 *
 * The SVGs are the source of truth; every PNG here is generated from them, so
 * the raster and vector versions can never drift. Re-run after any logo change:
 *   node scripts/build-brand.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve("public/brand");
const FG_DARK = "#E8E8E6";   // mark on a dark background
const FG_LIGHT = "#0B0B0C";  // mark on a light background
const BG_DARK = "#0B0B0C";

/** The mark, on a 24-unit grid. One source for every output. */
const mark = (fg) => `
  <path d="M3 8.5V5a2 2 0 0 1 2-2h3.5" stroke="${fg}" stroke-width="2.25" stroke-linecap="square"/>
  <path d="M21 15.5V19a2 2 0 0 1-2 2h-3.5" stroke="${fg}" stroke-width="2.25" stroke-linecap="square"/>
  <rect x="8.5" y="8.5" width="7" height="7" rx="1.25" fill="${fg}"/>`;

const markSvg = (fg, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  ${bg ? `<rect width="24" height="24" fill="${bg}"/>` : ""}${mark(fg)}
</svg>`;

const wordmarkSvg = (fg, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 103 24" fill="none">
  ${bg ? `<rect width="103" height="24" fill="${bg}"/>` : ""}${mark(fg)}
  <text x="32" y="17" font-family="Inter, Helvetica, Arial, sans-serif" font-size="15.5" font-weight="600" letter-spacing="-0.2" fill="${fg}">ClipCore</text>
</svg>`;

/** App icon: the mark inset on a solid tile, the way iOS and Android want it. */
const appIconSvg = (fg, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" fill="none">
  <rect width="180" height="180" fill="${bg}"/>
  <g transform="translate(38 38) scale(4.375)">${mark(fg)}</g>
</svg>`;

const png = async (svg, file, width, height) => {
  await sharp(Buffer.from(svg)).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(OUT, file));
  return file;
};

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const written = [];

  // ── Vector sources ────────────────────────────────────────────────────────
  const sources = {
    "mark-dark.svg": markSvg(FG_DARK),
    "mark-light.svg": markSvg(FG_LIGHT),
    "logo-dark.svg": wordmarkSvg(FG_DARK),
    "logo-light.svg": wordmarkSvg(FG_LIGHT),
    "app-icon.svg": appIconSvg(FG_DARK, BG_DARK),
  };
  for (const [file, svg] of Object.entries(sources)) {
    await fs.writeFile(path.join(OUT, file), svg);
    written.push(file);
  }

  // ── Mark, transparent, both colourways ────────────────────────────────────
  for (const size of [16, 32, 48, 64, 128, 256, 512, 1024]) {
    written.push(await png(sources["mark-dark.svg"], `mark-dark-${size}.png`, size, size));
    written.push(await png(sources["mark-light.svg"], `mark-light-${size}.png`, size, size));
  }

  // ── Wordmark, transparent ─────────────────────────────────────────────────
  for (const width of [280, 560, 1120]) {
    const height = Math.round((width / 103) * 24);
    written.push(await png(sources["logo-dark.svg"], `logo-dark-${width}.png`, width, height));
    written.push(await png(sources["logo-light.svg"], `logo-light-${width}.png`, width, height));
  }

  // ── App icon, solid tile ──────────────────────────────────────────────────
  for (const size of [180, 192, 512, 1024]) {
    written.push(await png(sources["app-icon.svg"], `app-icon-${size}.png`, size, size));
  }

  // ── favicon.ico: 16/32/48 packed into one file ────────────────────────────
  // Browsers still ask for /favicon.ico by name regardless of the <link> tags.
  const icoSizes = [16, 32, 48];
  const images = await Promise.all(
    icoSizes.map((s) =>
      sharp(Buffer.from(sources["mark-dark.svg"])).resize(s, s).png().toBuffer()
    )
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  images.forEach((buf, i) => {
    const size = icoSizes[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);              // palette
    entry.writeUInt8(0, 3);              // reserved
    entry.writeUInt16LE(1, 4);           // colour planes
    entry.writeUInt16LE(32, 6);          // bits per pixel
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(entry);
  });

  await fs.writeFile(path.join(OUT, "favicon.ico"), Buffer.concat([header, ...entries, ...images]));
  written.push("favicon.ico");

  console.log(`Wrote ${written.length} files to public/brand/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
