#!/usr/bin/env node
/**
 * Environment check.
 *
 * Config mistakes surface as opaque third-party errors — Google's
 * "invalid_client", Stripe's "No such price", a Prisma connection timeout —
 * and none of them say which variable is wrong. This does.
 *
 *   npm run doctor
 */
import fs from "node:fs";
import path from "node:path";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

const envPath = path.resolve(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error(`${RED}No .env file. Copy it first:${RESET}\n  cp .env.example .env\n`);
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const isPlaceholder = (value) =>
  !value ||
  /PASTE_|your_|user:password|localhost:5432\/db|price_\.\.\.|sk_test_\.\.\.|whsec_\.\.\./.test(value);

/** [key, required-for, validator, how-to-fix] */
const CHECKS = [
  ["DATABASE_URL", "sign-in", (v) => /^postgres(ql)?:\/\//.test(v), "Create a free project at neon.tech and paste the pooled connection string."],
  ["DIRECT_URL", "migrations", (v) => /^postgres(ql)?:\/\//.test(v), "Neon shows this as the direct (unpooled) connection string."],
  ["NEXTAUTH_SECRET", "sign-in", (v) => v.length >= 32, "openssl rand -base64 32"],
  ["NEXTAUTH_URL", "sign-in", (v) => /^https?:\/\//.test(v), "http://localhost:3000 for local development."],
  ["GOOGLE_CLIENT_ID", "sign-in", (v) => v.endsWith(".apps.googleusercontent.com"),
    "console.cloud.google.com/apis/credentials → OAuth client ID → Web application.\n     Redirect URI must be exactly: http://localhost:3000/api/auth/callback/google"],
  ["GOOGLE_CLIENT_SECRET", "sign-in", (v) => v.startsWith("GOCSPX-"), "Shown next to the client ID in Google Cloud Console."],
  ["ENCRYPTION_KEY", "social connections", (v) => Buffer.from(v, "base64").length === 32, "openssl rand -base64 32"],
  ["STRIPE_SECRET_KEY", "checkout", (v) => /^sk_(test|live)_/.test(v), "dashboard.stripe.com/apikeys"],
  ["STRIPE_PRICE_BASIC", "checkout", (v) => v.startsWith("price_"), "Create a recurring price in Stripe and paste its id."],
  ["R2_ACCOUNT_ID", "uploads", (v) => v.length > 8, "dash.cloudflare.com → R2 → account id."],
  ["OPENAI_API_KEY", "transcription", (v) => v.startsWith("sk-"), "Used by the worker for Whisper."],
  ["ANTHROPIC_API_KEY", "clip scoring", (v) => v.startsWith("sk-ant-"), "Used by the worker to score moments."],
];

const groups = new Map();
for (const [key, feature, validate, fix] of CHECKS) {
  const value = env[key] ?? process.env[key] ?? "";
  let state = "ok";
  if (isPlaceholder(value)) state = "missing";
  else if (!validate(value)) state = "invalid";

  if (!groups.has(feature)) groups.set(feature, []);
  groups.get(feature).push({ key, state, fix, value });
}

// System binaries the worker shells out to. A missing one fails at render
// time with an ENOENT that says nothing about which tool was absent.
import { execSync } from "node:child_process";

function binary(name, test) {
  try {
    const out = execSync(test, { stdio: ["ignore", "pipe", "ignore"] }).toString();
    return { ok: true, out };
  } catch {
    return { ok: false, out: "" };
  }
}

console.log("\nClipCore environment check\n");

const ffmpeg = binary("ffmpeg", "ffmpeg -hide_banner -version");
const ffprobe = binary("ffprobe", "ffprobe -hide_banner -version");
const ytdlp = binary("yt-dlp", "yt-dlp --version");
// The subtitles filter is libass-backed; without it caption burn-in silently
// has no way to run, which is the feature people pay for.
const libass = ffmpeg.ok && binary("libass", "ffmpeg -hide_banner -filters").out.includes("subtitles");

const renderOk = ffmpeg.ok && ffprobe.ok && ytdlp.ok && libass;
console.log(`${renderOk ? GREEN + "✓" : RED + "✗"}${RESET} video rendering ${DIM}(worker only)${RESET}`);
for (const [label, ok, fix] of [
  ["ffmpeg", ffmpeg.ok, "brew install ffmpeg"],
  ["ffprobe", ffprobe.ok, "ships with ffmpeg"],
  ["yt-dlp", ytdlp.ok, "brew install yt-dlp"],
  ["ffmpeg libass/subtitles filter", libass,
    "Your ffmpeg was built without libass, so captions cannot be burned in.\n             brew tap homebrew-ffmpeg/ffmpeg && brew install homebrew-ffmpeg/ffmpeg/ffmpeg --with-libass"],
]) {
  console.log(`    ${ok ? GREEN + "ok" + RESET + "      " : RED + "missing" + RESET + " "} ${label}`);
  if (!ok) console.log(`             ${DIM}${fix}${RESET}`);
}
console.log("");

let blocking = 0;
for (const [feature, items] of groups) {
  const broken = items.filter((i) => i.state !== "ok");
  const icon = broken.length === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  console.log(`${icon} ${feature}`);

  for (const item of items) {
    if (item.state === "ok") {
      console.log(`    ${GREEN}ok${RESET}       ${item.key}`);
    } else {
      blocking++;
      const label = item.state === "missing" ? `${RED}not set${RESET}` : `${YELLOW}invalid${RESET}`;
      console.log(`    ${label}  ${item.key}`);
      console.log(`             ${DIM}${item.fix}${RESET}`);
      if (item.state === "invalid") {
        console.log(`             ${DIM}currently: ${item.value.slice(0, 18)}…${RESET}`);
      }
    }
  }
  console.log("");
}

if (blocking === 0) {
  console.log(`${GREEN}Everything checks out.${RESET} Run: npm run dev\n`);
} else {
  console.log(`${YELLOW}${blocking} value${blocking === 1 ? "" : "s"} still to fill in.${RESET}`);
  console.log(`${DIM}Walkthrough: docs/LOCAL_SETUP.md`);
  console.log(`Restart the dev server after editing .env — it reads it at boot.${RESET}\n`);
}
