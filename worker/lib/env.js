/**
 * Load .env for the worker process.
 *
 * Next.js reads .env on its own; a plain `node worker/index.js` does not, so
 * without this the worker starts with no DATABASE_URL and no API keys.
 * Imported first in worker/index.js, before any module that reads
 * process.env at import time.
 *
 * Uses Node's built-in loader (Node 20.12+), so no dotenv dependency. Values
 * already set in the real environment win, matching Next.js' behaviour.
 */
import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), ".env");
if (fs.existsSync(file) && typeof process.loadEnvFile === "function") {
  const before = { ...process.env };
  process.loadEnvFile(file);
  for (const [key, value] of Object.entries(before)) process.env[key] = value;
}
