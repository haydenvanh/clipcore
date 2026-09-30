#!/usr/bin/env node
/**
 * Start the web app and the worker together.
 *
 * Two processes because a transcode can run for many minutes and shouldn't
 * live inside a web request — but one command, because a worker that isn't
 * running is invisible: videos just sit at "Queued" with no error anywhere.
 *
 * Output is prefixed so the two streams can be told apart, and if either
 * process exits the other is stopped, so there is never a half-running app.
 */
import { spawn } from "node:child_process";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = process.env.PORT || "3000";

const COLORS = { web: "\x1b[36m", worker: "\x1b[35m" };
const RESET = "\x1b[0m";

const children = [];
let shuttingDown = false;

function start(name, command, args) {
  const child = spawn(command, args, {
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  const prefix = `${COLORS[name]}${name.padEnd(6)}${RESET} │ `;
  const relay = (stream, out) => {
    let buffered = "";
    stream.on("data", (chunk) => {
      buffered += chunk;
      const lines = buffered.split("\n");
      buffered = lines.pop();
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  relay(child.stdout, process.stdout);
  relay(child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`\n${prefix}exited (${signal || `code ${code}`}) — stopping everything.`);
    stopAll(code ?? 1);
  });

  children.push(child);
  return child;
}

function stopAll(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  // Give the worker time to finish its in-flight jobs before we give up on it.
  setTimeout(() => process.exit(code), 3000).unref();
  Promise.all(children.map((c) => new Promise((r) => (c.exitCode !== null ? r() : c.on("exit", r))))).then(() =>
    process.exit(code)
  );
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

// Bound to 127.0.0.1: there is no login, so the app must not be reachable from
// other machines on the network.
start("web", "npx", ["next", "dev", "--hostname", HOST, "--port", PORT]);
start("worker", "node", ["worker/index.js"]);

console.log(`\n  ClipCore → http://localhost:${PORT}\n`);
