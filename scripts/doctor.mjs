#!/usr/bin/env node
/**
 * Check everything the pipeline needs, and say how to fix what's missing.
 *
 * Config problems otherwise surface as opaque errors from somewhere else —
 * an ENOENT from ffmpeg, a 401 from OpenAI, a video stuck at "Queued" — and
 * none of them say which setting is at fault.
 *
 *   npm run doctor
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { FFMPEG, FFPROBE } from "../worker/lib/binaries.js";
import { WHISPER_CLI, LOCAL_MODEL_PATH } from "../worker/lib/transcribe-local.js";

const RED = "\x1b[31m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m", DIM = "\x1b[2m", RESET = "\x1b[0m";

const envPath = path.resolve(".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

const placeholder = (v) => !v || /PASTE_|your_|user:password|localhost:5432\/db|sk-\.\.\./.test(v);

function sh(command) {
  try {
    return { ok: true, out: execSync(command, { stdio: ["ignore", "pipe", "pipe"] }).toString() };
  } catch (error) {
    return { ok: false, out: String(error.stdout || "") + String(error.stderr || "") };
  }
}

const checks = [];
const check = (group, label, ok, fix) => checks.push({ group, label, ok, fix });
/** Not needed to run; shown as "off" with what it would add. */
const optional = (group, label, ok, note) => checks.push({ group, label, ok, fix: note, optional: true });

// ── Keys ────────────────────────────────────────────────────────────────────
const db = process.env.DATABASE_URL;
check("config", "DATABASE_URL", !placeholder(db) && /^postgres(ql)?:\/\//.test(db || ""),
  "A Postgres connection string. Free at neon.tech, or `brew install postgresql@16`.");
const hasOpenAi = !placeholder(process.env.OPENAI_API_KEY) && /^sk-/.test(process.env.OPENAI_API_KEY || "");
optional("config", "OPENAI_API_KEY", hasOpenAi,
  "Optional. Without it, transcription runs locally with whisper.cpp (free).");
optional("config", "ANTHROPIC_API_KEY", !placeholder(process.env.ANTHROPIC_API_KEY) && /^sk-ant-/.test(process.env.ANTHROPIC_API_KEY || ""),
  "Optional. Without it, clips are picked from transcript signals (free). With it, Claude picks them.");

// ── Tools ───────────────────────────────────────────────────────────────────
// Same resolution the worker uses, so this checks the ffmpeg that will
// actually run — not just whichever one is first on PATH.
const ffmpeg = sh(`"${FFMPEG}" -hide_banner -version`);
check("tools", `ffmpeg ${DIM}(${FFMPEG})${RESET}`, ffmpeg.ok, "brew install ffmpeg-full");
check("tools", "ffprobe", sh(`"${FFPROBE}" -hide_banner -version`).ok, "Installed with ffmpeg.");
check("tools", "yt-dlp", sh("yt-dlp --version").ok, "brew install yt-dlp");
check("tools", "ffmpeg can burn captions (libass)",
  ffmpeg.ok && / subtitles /.test(sh(`"${FFMPEG}" -hide_banner -filters`).out),
  "This ffmpeg has no libass, so captions can't be burned in. Install the full build\n" +
  "     (prebuilt, and it sits alongside your current ffmpeg rather than replacing it):\n" +
  "     brew install ffmpeg-full");

// Local transcription is only needed when there's no OpenAI key.
const whisper = sh(`"${WHISPER_CLI}" --help`);
const localCheck = hasOpenAi ? optional : check;
localCheck("tools", "whisper.cpp", whisper.ok || /usage: whisper-cli/.test(whisper.out), "brew install whisper-cpp");
localCheck("tools", `speech model ${DIM}(${path.relative(process.cwd(), LOCAL_MODEL_PATH)})${RESET}`,
  fs.existsSync(LOCAL_MODEL_PATH), "npm run setup:model   (downloads ~550 MB, once)");

// ── Database ────────────────────────────────────────────────────────────────
if (!placeholder(db)) {
  const status = sh("npx prisma migrate status");
  const text = status.out;
  const reachable = !/P1001|Can't reach database|ENOTFOUND|ECONNREFUSED/.test(text);
  check("database", "reachable", reachable, "Check DATABASE_URL, and that the database is running.");
  if (reachable) {
    check("database", "migrated", /up to date|No pending migrations/i.test(text), "npm run db:migrate");
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log("\nClipCore check\n");
let failing = 0;
for (const group of ["config", "tools", "database"]) {
  const items = checks.filter((c) => c.group === group);
  if (items.length === 0) continue;
  console.log(`${items.every((i) => i.ok || i.optional) ? GREEN + "✓" : RED + "✗"}${RESET} ${group}`);
  for (const item of items) {
    if (item.ok) {
      console.log(`    ${GREEN}ok${RESET}       ${item.label}`);
    } else if (item.optional) {
      console.log(`    ${DIM}off${RESET}      ${item.label}`);
      console.log(`             ${DIM}${item.fix}${RESET}`);
    } else {
      failing++;
      console.log(`    ${RED}missing${RESET}  ${item.label}`);
      console.log(`             ${DIM}${item.fix}${RESET}`);
    }
  }
  console.log("");
}

if (failing === 0) {
  console.log(`${GREEN}Ready.${RESET} Run: npm run dev\n`);
} else {
  console.log(`${YELLOW}${failing} thing${failing === 1 ? "" : "s"} to fix.${RESET} ${DIM}Restart npm run dev after editing .env.${RESET}\n`);
  process.exitCode = 1;
}
