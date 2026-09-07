import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

/**
 * Fixed-window rate limiting, backed by Postgres.
 *
 * Every generation costs us real vendor money, so an unmetered endpoint is a
 * bill waiting to happen. The counters live in Postgres rather than in memory
 * because Vercel runs many instances: a per-instance counter silently
 * multiplies the effective limit by the number of instances, which is exactly
 * the situation where a limit matters.
 *
 * Fixed windows can allow up to 2x the limit across a window boundary. That is
 * an accepted trade for one indexed upsert per request; a sliding window would
 * cost a range scan for a precision nobody here needs.
 */

export const LIMITS = {
  /** Expensive: each one starts a vendor job. */
  generate: { limit: 10, windowSec: 60 },
  /** Cheap but abusable — it hands out a signed upload URL. */
  upload: { limit: 20, windowSec: 60 },
  /** Polling is frequent by design; this only stops a runaway client. */
  status: { limit: 120, windowSec: 60 },
  /** Checkout and portal redirects. */
  billing: { limit: 10, windowSec: 60 },
  /** OAuth connect/disconnect. */
  social: { limit: 20, windowSec: 300 },
  /** Publishing to a platform. */
  publish: { limit: 15, windowSec: 300 },
  /** Catch-all for anything else that mutates. */
  default: { limit: 60, windowSec: 60 },
};

/**
 * Count one hit against a bucket.
 *
 * @returns {Promise<{ok: boolean, remaining: number, resetAt: Date, limit: number}>}
 */
export async function checkRateLimit(bucket, subject, overrides = {}) {
  const config = { ...(LIMITS[bucket] ?? LIMITS.default), ...overrides };
  const key = `${bucket}:${subject}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.windowSec * 1000);

  // One statement: insert the row, or increment it and roll the window if the
  // old one has expired. Doing this as read-then-write would race exactly like
  // the credit bug did.
  const rows = await prisma.$queryRaw`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, ${now}, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE
      SET "count" = CASE
            WHEN "RateLimit"."expiresAt" <= ${now} THEN 1
            ELSE "RateLimit"."count" + 1
          END,
          "windowStart" = CASE
            WHEN "RateLimit"."expiresAt" <= ${now} THEN ${now}
            ELSE "RateLimit"."windowStart"
          END,
          "expiresAt" = CASE
            WHEN "RateLimit"."expiresAt" <= ${now} THEN ${expiresAt}
            ELSE "RateLimit"."expiresAt"
          END
    RETURNING "count", "expiresAt"
  `;

  const { count, expiresAt: resetAt } = rows[0];

  return {
    ok: count <= config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - count),
    resetAt,
  };
}

/**
 * Enforce a limit, throwing a 429 when exceeded.
 *
 * Fails open on a database error: a rate limiter that takes the whole product
 * down when Postgres hiccups is a worse outage than the abuse it prevents.
 */
export async function enforceRateLimit(bucket, subject, overrides) {
  let result;
  try {
    result = await checkRateLimit(bucket, subject, overrides);
  } catch (error) {
    console.error("[RATE_LIMIT] check failed, allowing request", error.message);
    return { ok: true, degraded: true };
  }

  if (!result.ok) {
    const seconds = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
    throw new ApiError(429, `Too many requests. Try again in ${seconds}s.`);
  }

  return result;
}

/** Identify an anonymous caller. Only for unauthenticated endpoints. */
export function clientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** Housekeeping: drop expired counters. Safe to run on a schedule. */
export async function pruneRateLimits() {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
