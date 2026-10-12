#!/usr/bin/env node
/**
 * Move videos made before sign-in existed into a Google account.
 *
 * The single-user version stored everything under a built-in "local-owner"
 * user. After sign-in, each account only sees its own videos, so those would
 * disappear. This moves them — database rows and files — to the account with
 * the given email. Sign in with that account once first.
 *
 *   npm run claim-videos -- you@gmail.com
 *
 * Local storage only (the default). Safe to run twice: the second run finds
 * nothing left to move.
 */
import "../worker/lib/env.js";
import fs from "node:fs";
import path from "node:path";
import { prisma, disconnect } from "../worker/lib/db.js";

const LEGACY_ID = "local-owner";
const ROOT = path.resolve(process.env.LOCAL_STORAGE_DIR || ".storage");

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run claim-videos -- you@gmail.com");
  process.exit(1);
}

try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account for ${email} yet. Sign in once with that Google account, then run this again.`);
    process.exit(1);
  }

  const videos = await prisma.video.count({ where: { userId: LEGACY_ID } });
  if (videos === 0) {
    console.log("Nothing to move: there are no videos from before sign-in.");
    process.exit(0);
  }

  // Files first. If the database update then failed, the old keys would point
  // at moved files — so on failure, the moves are undone.
  const moved = [];
  for (const top of ["sources", "clips"]) {
    const from = path.join(ROOT, top, LEGACY_ID);
    if (!fs.existsSync(from)) continue;
    const to = path.join(ROOT, top, user.id);
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      fs.renameSync(path.join(from, entry), path.join(to, entry));
      moved.push([path.join(from, entry), path.join(to, entry)]);
    }
  }

  try {
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE "Video" SET "userId" = ${user.id},
          "storageKey"   = replace("storageKey",   ${`sources/${LEGACY_ID}/`}, ${`sources/${user.id}/`}),
          "thumbnailKey" = replace("thumbnailKey", ${`sources/${LEGACY_ID}/`}, ${`sources/${user.id}/`})
        WHERE "userId" = ${LEGACY_ID}`,
      prisma.$executeRaw`UPDATE "Clip" SET "userId" = ${user.id} WHERE "userId" = ${LEGACY_ID}`,
      prisma.$executeRaw`
        UPDATE "Render" SET "userId" = ${user.id},
          "storageKey"   = replace("storageKey",   ${`clips/${LEGACY_ID}/`}, ${`clips/${user.id}/`}),
          "thumbnailKey" = replace("thumbnailKey", ${`clips/${LEGACY_ID}/`}, ${`clips/${user.id}/`})
        WHERE "userId" = ${LEGACY_ID}`,
    ]);
  } catch (error) {
    for (const [from, to] of moved.reverse()) fs.renameSync(to, from);
    throw error;
  }

  for (const top of ["sources", "clips"]) {
    fs.rmSync(path.join(ROOT, top, LEGACY_ID), { recursive: true, force: true });
  }

  console.log(`Moved ${videos} video${videos === 1 ? "" : "s"} and their clips to ${email}.`);
} finally {
  await disconnect();
}
