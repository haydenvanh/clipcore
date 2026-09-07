#!/usr/bin/env node
/**
 * Plan the production environment.
 *
 * Two processes need different subsets of the same config: the Next.js app on
 * Vercel and the worker on Railway. Several values must *not* be copied from
 * local — Stripe's webhook secret differs between test and live mode, and a
 * copied one silently drops every payment event with no error anywhere.
 *
 *   node scripts/deploy-env.mjs            # show the plan
 *   node scripts/deploy-env.mjs --commands # print the CLI commands
 */
import fs from "node:fs";
import path from "node:path";

const RESET = "\x1b[0m", DIM = "\x1b[2m", RED = "\x1b[31m";
const GREEN = "\x1b[32m", YELLOW = "\x1b[33m", BOLD = "\x1b[1m";

const WEB = "web", WORKER = "worker", BOTH = "both";

/**
 * key, where it runs, and whether the production value differs from local.
 * "regenerate" means do not copy the local value under any circumstances.
 */
const VARS = [
  ["DATABASE_URL", BOTH, "same", "Same database for both processes."],
  ["DIRECT_URL", WEB, "same", "Migrations only."],
  ["NEXTAUTH_URL", WEB, "change", "Must be your production origin, not localhost."],
  ["NEXTAUTH_SECRET", WEB, "regenerate", "Generate a fresh one: openssl rand -base64 32"],
  ["GOOGLE_CLIENT_ID", WEB, "same", "Add the production redirect URI in Google Cloud."],
  ["GOOGLE_CLIENT_SECRET", WEB, "same", ""],
  ["ENCRYPTION_KEY", BOTH, "regenerate", "Fresh key. Both processes need the SAME value or stored OAuth tokens cannot be decrypted."],
  ["STRIPE_SECRET_KEY", WEB, "change", "Live key (sk_live_…), not the test key."],
  ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", WEB, "change", "Live publishable key. Inlined at build time."],
  ["STRIPE_WEBHOOK_SECRET", WEB, "change", "Live-mode endpoints have their OWN secret. Copying the test one silently drops every event."],
  ["STRIPE_PRICE_BASIC", WEB, "change", "Live-mode price ids differ from test-mode ids."],
  ["STRIPE_PRICE_PRO", WEB, "change", ""],
  ["STRIPE_PRICE_ULTRA", WEB, "change", ""],
  ["STRIPE_PRICE_BASIC_ANNUAL", WEB, "change", ""],
  ["STRIPE_PRICE_PRO_ANNUAL", WEB, "change", ""],
  ["STRIPE_PRICE_ULTRA_ANNUAL", WEB, "change", ""],
  ["CRON_SECRET", WEB, "regenerate", "Authorises the credit-grant cron."],
  ["AICLIPS_API_KEY", WEB, "same", ""],
  ["WEBHOOK_URL", WEB, "change", "Your production origin — where the provider calls back."],
  ["MUAPI_WEBHOOK_SECRET", WEB, "regenerate", "Fresh secret."],
  ["R2_ACCOUNT_ID", BOTH, "same", ""],
  ["R2_ACCESS_KEY_ID", BOTH, "same", ""],
  ["R2_SECRET_ACCESS_KEY", BOTH, "same", ""],
  ["R2_BUCKET", BOTH, "same", "Consider a separate production bucket."],
  ["OPENAI_API_KEY", WORKER, "same", "Whisper. Worker only — never expose it to the web tier."],
  ["ANTHROPIC_API_KEY", WORKER, "same", "Clip scoring. Worker only."],
  ["WORKER_CONCURRENCY", WORKER, "change", "2 is a sensible start."],
  ["SENTRY_DSN", BOTH, "same", "Optional."],
  ["NEXT_PUBLIC_THEME", WEB, "same", "Optional."],
];

const envPath = path.resolve(process.cwd(), ".env");
const local = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) local[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const isSet = (v) => v && !/PASTE_|your_|user:password|localhost:5432\/db|price_\.\.\.|sk_test_\.\.\.|whsec_\.\.\./.test(v);
const wantCommands = process.argv.includes("--commands");

if (wantCommands) {
  console.log("# Vercel — run from the project root after `vercel link`");
  for (const [key, where, action] of VARS) {
    if (where === WORKER) continue;
    const note = action === "same" && isSet(local[key]) ? "" : `  # ${action.toUpperCase()}`;
    console.log(`vercel env add ${key} production${note}`);
  }
  console.log("\n# Railway — worker service");
  for (const [key, where] of VARS) {
    if (where === WEB) continue;
    console.log(`railway variables set ${key}=...`);
  }
  process.exit(0);
}

const group = (where) => VARS.filter(([, w]) => w === where || w === BOTH);

console.log(`\n${BOLD}Production environment plan${RESET}\n`);

for (const [title, where, hint] of [
  ["Vercel (web)", WEB, "Settings → Environment Variables, or `vercel env add`"],
  ["Railway (worker)", WORKER, "Service → Variables"],
]) {
  console.log(`${BOLD}${title}${RESET} ${DIM}${hint}${RESET}`);

  for (const [key, w, action, why] of group(where)) {
    const shared = w === BOTH ? `${DIM} (also on the other)${RESET}` : "";
    let tag;
    if (action === "regenerate") tag = `${RED}regenerate${RESET}`;
    else if (action === "change") tag = `${YELLOW}new value${RESET}`;
    else tag = isSet(local[key]) ? `${GREEN}copy local${RESET}` : `${DIM}not set${RESET}`;

    console.log(`  ${tag.padEnd(22)} ${key}${shared}`);
    if (why) console.log(`  ${" ".repeat(11)}${DIM}${why}${RESET}`);
  }
  console.log("");
}

console.log(`${BOLD}Traps${RESET}`);
console.log(`  ${DIM}1. ENCRYPTION_KEY must be IDENTICAL on Vercel and Railway.`);
console.log(`     Different values mean the worker cannot decrypt stored OAuth tokens.`);
console.log(`  2. Live-mode Stripe webhooks have their own signing secret. Reusing the`);
console.log(`     test one fails signature verification on every event, silently.`);
console.log(`  3. NEXT_PUBLIC_* is inlined at build time — changing it needs a redeploy,`);
console.log(`     not just a restart.`);
console.log(`  4. Add the production redirect URI to Google Cloud BEFORE first sign-in:`);
console.log(`     https://<domain>/api/auth/callback/google${RESET}\n`);
