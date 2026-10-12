#!/usr/bin/env node
/**
 * Production start: apply migrations, make sure the local speech models are
 * on disk, then run the web app and the worker together.
 *
 * Used as the container's command (see Dockerfile). Migrations run here rather
 * than at build time because the build has no database access.
 */
import { execFileSync } from "node:child_process";
import { supervise } from "./lib/supervise.mjs";

const PORT = process.env.PORT || "3000";

execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });

// Local transcription needs its models; skip when the OpenAI API does it.
if (!process.env.OPENAI_API_KEY) {
  execFileSync("node", ["scripts/setup-model.mjs"], { stdio: "inherit" });
}

supervise([
  // 0.0.0.0: in a container the platform's router must be able to reach it.
  { name: "web", command: "npx", args: ["next", "start", "--hostname", "0.0.0.0", "--port", PORT] },
  { name: "worker", command: "node", args: ["worker/index.js"] },
]);
