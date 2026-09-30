import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { pinSslMode } from "../../worker/lib/connection-string.js";

/**
 * One Prisma client per server process.
 *
 * Cached on globalThis so dev-mode hot reloads reuse it instead of opening a
 * new connection pool on every edit — the pool is cached alongside it for the
 * same reason, since a fresh Pool per reload leaks connections until Postgres
 * refuses new ones.
 *
 * Errors and warnings only: logging every query would flood the terminal,
 * since the pages poll for progress every few seconds.
 */
const globalForPrisma = globalThis;

function createClient() {
  const pool = new Pool({ connectionString: pinSslMode(process.env.DATABASE_URL), max: 5 });
  return new PrismaClient({ adapter: new PrismaPg(pool), log: ["error", "warn"] });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
