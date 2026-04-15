import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { withHandler } from "@/lib/api";
import { db } from "@/lib/db";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Auto-archive shift groups for events that have ended.
 *
 * Runs nightly at 3 AM Central (08:00 UTC, matching the notifications cron).
 * Sets archivedAt on any ShiftGroup whose event ended before now and hasn't
 * been manually archived yet.
 *
 * Does NOT delete any data — archiving is purely a status marker that locks
 * attendance records and signals the event is complete.
 */
export const GET = withHandler(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const token = authHeader?.replace("Bearer ", "") ?? "";
  if (!safeCompare(token, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all unarchived shift groups whose event has already ended
  const groups = await db.shiftGroup.findMany({
    where: {
      archivedAt: null,
      event: {
        endsAt: { lt: now },
      },
    },
    select: { id: true },
  });

  if (groups.length === 0) {
    return NextResponse.json({ ok: true, archived: 0 });
  }

  const result = await db.shiftGroup.updateMany({
    where: {
      id: { in: groups.map((g) => g.id) },
      archivedAt: null, // double-check to prevent race with manual archive
    },
    data: { archivedAt: now },
  });

  return NextResponse.json({
    ok: true,
    archived: result.count,
    runAt: now.toISOString(),
  });
});
