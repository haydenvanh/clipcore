/**
 * Credit ledger — runtime-agnostic core.
 *
 * CreditLedger is append-only and is the source of truth; User.credits is a
 * cache written inside the same transaction as every entry. A mistake is
 * corrected by writing a compensating ADJUST row, never by editing history.
 *
 * The charge model is hold -> settle | refund:
 *   HOLD    reserve credits when a job is enqueued
 *   SETTLE  convert the hold to a real charge at actual usage
 *   REFUND  return the hold when the job fails
 *
 * This is what stops a failed job from silently burning a user's balance,
 * which the previous implementation did on every provider error.
 *
 * Exported as a factory over a Prisma client rather than a singleton: the web
 * app and the worker are separate processes with separate clients, and the
 * worker cannot resolve Next's "@/" alias. One implementation, two bindings —
 * two copies of money logic is how the original bugs got in.
 */

export class InsufficientCreditsError extends Error {
  constructor(required, available) {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
    this.required = required;
    this.available = available;
  }
}

/**
 * Write one ledger entry and move the cached balance atomically.
 *
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 */
async function writeEntry(tx, { userId, delta, type, refType, refId, idempotencyKey, description }) {
  // Debits use a conditional UPDATE so the balance check and the write are a
  // single statement. Two concurrent debits cannot both pass the check.
  const rows =
    delta < 0
      ? await tx.$queryRaw`
          UPDATE "User" SET credits = credits + ${delta}
           WHERE id = ${userId} AND credits >= ${-delta}
          RETURNING credits`
      : await tx.$queryRaw`
          UPDATE "User" SET credits = credits + ${delta}
           WHERE id = ${userId}
          RETURNING credits`;

  if (!rows || rows.length === 0) {
    if (delta < 0) {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
      throw new InsufficientCreditsError(-delta, user?.credits ?? 0);
    }
    throw new Error(`User ${userId} not found`);
  }

  const balanceAfter = rows[0].credits;

  await tx.creditLedger.create({
    data: { userId, delta, type, balanceAfter, refType, refId, idempotencyKey, description },
  });

  return balanceAfter;
}

export function createCreditService(prisma) {
  return {
    async getBalance(userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });
      return user?.credits ?? 0;
    },

    /**
     * Add credits. `idempotencyKey` makes a retried Stripe webhook a no-op
     * instead of a second grant — the unique constraint does the work.
     */
    async grant(userId, amount, { type = "GRANT", refType, refId, idempotencyKey, description } = {}) {
      if (!Number.isInteger(amount) || amount <= 0) return this.getBalance(userId);

      if (idempotencyKey) {
        const existing = await prisma.creditLedger.findUnique({ where: { idempotencyKey } });
        if (existing) return existing.balanceAfter;
      }

      try {
        return await prisma.$transaction((tx) =>
          writeEntry(tx, {
            userId, delta: amount, type, refType, refId, idempotencyKey, description,
          })
        );
      } catch (error) {
        // Lost a race with a concurrent delivery of the same event.
        if (error.code === "P2002") return this.getBalance(userId);
        throw error;
      }
    },

    /** Reserve credits for a job. Throws InsufficientCreditsError if short. */
    async hold(userId, amount, { refType, refId, description } = {}) {
      if (!Number.isInteger(amount) || amount <= 0) return this.getBalance(userId);
      return prisma.$transaction((tx) =>
        writeEntry(tx, {
          userId, delta: -amount, type: "HOLD", refType, refId,
          description: description ?? `Reserved ${amount} credits`,
        })
      );
    },

    /**
     * Settle a hold against actual usage.
     *
     * Charging less than we held returns the difference; charging more takes it,
     * and if the balance cannot cover the extra we absorb it rather than pushing
     * the user negative. Eating a few credits is cheaper than a support ticket.
     */
    async settle(userId, heldAmount, actualAmount, { refType, refId } = {}) {
      const difference = heldAmount - actualAmount;
      if (difference === 0) {
        await prisma.creditLedger.create({
          data: {
            userId, delta: 0, type: "SETTLE",
            balanceAfter: await this.getBalance(userId),
            refType, refId, description: `Settled ${actualAmount} credits`,
          },
        });
        return this.getBalance(userId);
      }

      if (difference > 0) {
        return this.grant(userId, difference, {
          type: "SETTLE", refType, refId,
          description: `Settled ${actualAmount} of ${heldAmount} held`,
        });
      }

      try {
        return await prisma.$transaction((tx) =>
          writeEntry(tx, {
            userId, delta: difference, type: "SETTLE", refType, refId,
            description: `Settled ${actualAmount} against ${heldAmount} held`,
          })
        );
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          console.warn("[CREDITS] Absorbing overage", { userId, heldAmount, actualAmount });
          return this.getBalance(userId);
        }
        throw error;
      }
    },

    /** Return a hold after a failure. Idempotent per (refType, refId). */
    async refund(userId, amount, { refType, refId, description } = {}) {
      if (!Number.isInteger(amount) || amount <= 0) return this.getBalance(userId);

      if (refType && refId) {
        const already = await prisma.creditLedger.findFirst({
          where: { userId, refType, refId, type: "REFUND" },
        });
        if (already) return already.balanceAfter;
      }

      return prisma.$transaction((tx) =>
        writeEntry(tx, {
          userId, delta: amount, type: "REFUND", refType, refId,
          description: description ?? `Refunded ${amount} credits`,
        })
      );
    },

    /** Support correction. Never edit a balance directly — write one of these. */
    async adjust(userId, delta, description) {
      if (!Number.isInteger(delta) || delta === 0) return this.getBalance(userId);
      return prisma.$transaction((tx) =>
        writeEntry(tx, { userId, delta, type: "ADJUST", description })
      );
    },

    async history(userId, { limit = 50, cursor } = {}) {
      const take = Math.min(200, Math.max(1, limit));
      const rows = await prisma.creditLedger.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > take;
      const items = hasMore ? rows.slice(0, take) : rows;
      return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
    },

    /**
     * Assert the cache matches the ledger. Run nightly; drift means a write
     * escaped the transaction and must be investigated, not silently repaired.
     */
    async reconcile(userId) {
      const [user, aggregate] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }),
        prisma.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } }),
      ]);
      const cached = user?.credits ?? 0;
      const ledger = aggregate._sum.delta ?? 0;
      return { userId, cached, ledger, drift: cached - ledger, ok: cached === ledger };
    },
  };
}
