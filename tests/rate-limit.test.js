import { describe, it, expect, vi, beforeEach } from "vitest";

const prisma = { $queryRaw: vi.fn(), rateLimit: { deleteMany: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/services/credits", () => ({ InsufficientCreditsError: class extends Error {} }));

const { checkRateLimit, enforceRateLimit, clientIp, LIMITS, pruneRateLimits } =
  await import("@/lib/rate-limit");

/** The counter value Postgres would return after this many hits. */
function returns(count, msUntilReset = 60_000) {
  prisma.$queryRaw.mockResolvedValueOnce([
    { count, expiresAt: new Date(Date.now() + msUntilReset) },
  ]);
}

describe("checkRateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows a request inside the window and reports what is left", async () => {
    returns(3);
    const result = await checkRateLimit("generate", "user_1");
    expect(result.ok).toBe(true);
    expect(result.limit).toBe(LIMITS.generate.limit);
    expect(result.remaining).toBe(LIMITS.generate.limit - 3);
  });

  it("allows exactly the limit, and refuses the one after", async () => {
    returns(LIMITS.generate.limit);
    expect((await checkRateLimit("generate", "u")).ok).toBe(true);

    returns(LIMITS.generate.limit + 1);
    expect((await checkRateLimit("generate", "u")).ok).toBe(false);
  });

  it("never reports negative remaining", async () => {
    returns(999);
    expect((await checkRateLimit("generate", "u")).remaining).toBe(0);
  });

  it("falls back to the default bucket for an unknown name", async () => {
    returns(1);
    expect((await checkRateLimit("not_a_bucket", "u")).limit).toBe(LIMITS.default.limit);
  });

  it("accepts a per-call override", async () => {
    returns(4);
    const result = await checkRateLimit("generate", "u", { limit: 3 });
    expect(result.limit).toBe(3);
    expect(result.ok).toBe(false);
  });

  it("scopes the counter to bucket and subject together", async () => {
    returns(1);
    await checkRateLimit("generate", "user_abc");
    // The key is interpolated into the tagged template's values array.
    const values = prisma.$queryRaw.mock.calls[0].slice(1);
    expect(values).toContain("generate:user_abc");
  });

  it("counts in a single statement, so two concurrent hits cannot both pass", async () => {
    returns(1);
    await checkRateLimit("generate", "u");
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(String(prisma.$queryRaw.mock.calls[0][0])).toContain("ON CONFLICT");
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes through when under the limit", async () => {
    returns(1);
    await expect(enforceRateLimit("generate", "u")).resolves.toMatchObject({ ok: true });
  });

  it("throws a 429 naming the wait", async () => {
    returns(LIMITS.generate.limit + 1, 30_000);
    await expect(enforceRateLimit("generate", "u")).rejects.toMatchObject({ status: 429 });

    returns(LIMITS.generate.limit + 1, 30_000);
    await expect(enforceRateLimit("generate", "u")).rejects.toThrow(/Try again in \d+s/);
  });

  it("fails open when the database is down", async () => {
    // A rate limiter that takes the product down when Postgres hiccups is a
    // worse outage than the abuse it prevents.
    prisma.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    await expect(enforceRateLimit("generate", "u")).resolves.toMatchObject({
      ok: true, degraded: true,
    });
  });
});

describe("bucket configuration", () => {
  it("prices generation far tighter than polling, because generation costs money", () => {
    expect(LIMITS.generate.limit).toBeLessThan(LIMITS.status.limit);
  });

  it("defines every bucket the routes reference", () => {
    for (const bucket of ["generate", "upload", "status", "billing", "social", "publish", "default"]) {
      expect(LIMITS[bucket], bucket).toBeDefined();
      expect(LIMITS[bucket].limit).toBeGreaterThan(0);
      expect(LIMITS[bucket].windowSec).toBeGreaterThan(0);
    }
  });
});

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    const req = { headers: new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }) };
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip, then to a placeholder", () => {
    expect(clientIp({ headers: new Headers({ "x-real-ip": "9.9.9.9" }) })).toBe("9.9.9.9");
    expect(clientIp({ headers: new Headers() })).toBe("unknown");
  });
});

describe("pruneRateLimits", () => {
  it("deletes only expired counters", async () => {
    prisma.rateLimit.deleteMany.mockResolvedValueOnce({ count: 7 });
    expect(await pruneRateLimits()).toBe(7);
    expect(prisma.rateLimit.deleteMany.mock.calls[0][0].where.expiresAt.lt).toBeInstanceOf(Date);
  });
});
