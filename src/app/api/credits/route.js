import { NextResponse } from "next/server";
import { CreditService } from "@/lib/services/credits";
import { handler, requireUser } from "@/lib/api";

/**
 * Balance plus ledger history.
 *
 * The history is the point: a bare number cannot answer "why is my balance 43?",
 * which is the question every support email about credits actually asks.
 */
export const GET = handler("CREDITS", async (req) => {
  const user = await requireUser();

  const params = new URL(req.url).searchParams;
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") || "25", 10) || 25));

  const [balance, history] = await Promise.all([
    CreditService.getBalance(user.id),
    CreditService.history(user.id, { limit, cursor: params.get("cursor") }),
  ]);

  return NextResponse.json({ balance, ...history });
});
