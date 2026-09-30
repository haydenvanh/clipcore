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

// ── Keys ────────────────────────────────────────────────────────────────────
const db = process.env.DATABASE_URL;
check("config", "DATABASE_URL", !placeholder(db) && /^postgres(ql)?:\/\//.test(db || ""),
  "A Postgres connection string. Free at neon.tech, or `brew install postgresql@16`.");
check("config", "OPENAI_API_KEY", !placeholder(process.env.OPENAI_API_KEY) && /^sk-/.test(process.env.OPENAI_API_KEY || ""),
  "platform.openai.com/api-keys — used for Whisper transcription (~$0.006/min of video).");
check("config", "ANTHROPIC_API_KEY", !placeholder(process.env.ANTHROPIC_API_KEY) && /^sk-ant-/.test(process.env.ANTHROPIC_API_KEY || ""),
  "console.anthropic.com — used to pick the best moments (~$0.10 per hour of video).");

// ── Tools ───────────────────────────────────────────────────────────────────
const ffmpeg = sh("ffmpeg -hide_banner -version");
check("tools", "ffmpeg", ffmpeg.ok, "brew install ffmpeg");
check("tools", "ffprobe", sh("ffprobe -hide_banner -version").ok, "Installed with ffmpeg.");
check("tools", "yt-dlp", sh("yt-dlp --version").ok, "brew install yt-dlp");
check("tools", "ffmpeg can burn captions (libass)",
  ffmpeg.ok && sh("ffmpeg -hide_banner -filters").out.includes(" subtitles "),
  "This ffmpeg was built without libass, so captions cannot be burned in:\n" +
  "     brew uninstall --ignore-dependencies ffmpeg\n" +
  "     brew tap homebrew-ffmpeg/ffmpeg && brew install homebrew-ffmpeg/ffmpeg/ffmpeg");

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
  console.log(`${items.every((i) => i.ok) ? GREEN + "✓" : RED + "✗"}${RESET} ${group}`);
  for (const item of items) {
    if (item.ok) {
      console.log(`    ${GREEN}ok${RESET}       ${item.label}`);
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
