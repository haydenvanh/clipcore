import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

/**
 * Prisma client for the worker process.
 *
 * Separate from src/lib/prisma.js because the worker runs outside Next.js and
 * cannot resolve the "@/" alias. Same schema, same generated client.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // The worker is long-lived and concurrency is bounded by WORKER_CONCURRENCY,
  // so a small pool is plenty and keeps us inside Neon's connection limit.
  max: Number(process.env.WORKER_DB_POOL || 5),
});

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

export async function disconnect() {
  await prisma.$disconnect();
  await pool.end();
}
