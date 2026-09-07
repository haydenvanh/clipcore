import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600; // an hour is fresh enough for a marketing counter

/**
 * Public usage counts for the landing page.
 *
 * Aggregates only — no per-user data leaves this endpoint. Real numbers rather
 * than invented ones: a claim on a commercial site should be one we can stand
 * behind if somebody asks.
 */
export async function GET() {
  try {
    const [clips, users, durationAgg, captionedRenders] = await Promise.all([
      prisma.clip.count(),
      prisma.user.count(),
      prisma.video.aggregate({ _sum: { durationSec: true }, where: { status: "COMPLETED" } }),
      prisma.render.count({ where: { status: "COMPLETED", captionStyle: { not: "NONE" } } }),
    ]);

    const totalSeconds = durationAgg._sum.durationSec ?? 0;

    return NextResponse.json({
      clips,
      users,
      hours: Math.floor(totalSeconds / 3600),
      captionMinutes: Math.floor((captionedRenders * 45) / 60),
    });
  } catch (error) {
    console.error("[STATS]", error);
    // The landing page must render even when the database is unreachable.
    return NextResponse.json({ clips: 0, users: 0, hours: 0, captionMinutes: 0 });
  }
}
