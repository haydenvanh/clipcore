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

console.log("\nClipCore environment check\n");

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
