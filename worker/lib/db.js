import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { pinSslMode } from "./connection-string.js";

/**
 * Prisma client for the worker process.
 *
 * Separate from src/lib/prisma.js because the worker runs outside Next.js and
 * cannot resolve the "@/" alias. Same schema, same generated client.
 */
const pool = new Pool({
  connectionString: pinSslMode(process.env.DATABASE_URL),
  // Long-lived process with bounded concurrency, so a small pool is plenty.
  max: Number(process.env.WORKER_DB_POOL || 5),
});

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

export async function disconnect() {
  await prisma.$disconnect();
  await pool.end();
}
