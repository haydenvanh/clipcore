#!/usr/bin/env node
/**
 * Start the web app and the worker together, for development.
 *
 * Two processes because a transcode can run for many minutes and shouldn't
 * live inside a web request — but one command, because a worker that isn't
 * running is invisible: videos just sit at "Queued" with no error anywhere.
 */
import { supervise } from "./lib/supervise.mjs";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = process.env.PORT || "3000";

// Bound to 127.0.0.1 in development, so only this computer can reach it.
supervise([
  { name: "web", command: "npx", args: ["next", "dev", "--hostname", HOST, "--port", PORT] },
  { name: "worker", command: "node", args: ["worker/index.js"] },
]);

console.log(`\n  ClipCore → http://localhost:${PORT}\n`);
