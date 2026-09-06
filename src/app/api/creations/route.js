import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, requireUser } from "@/lib/api";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

// Was unpaginated: it returned a user's entire history on every gallery load.
export const GET = handler("CREATIONS", async (req) => {
  const user = await requireUser();

  const params = new URL(req.url).searchParams;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(params.get("limit") || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT)
  );
  const cursor = params.get("cursor");

  const creations = await prisma.creation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = creations.length > limit;
  const items = hasMore ? creations.slice(0, limit) : creations;

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
});
