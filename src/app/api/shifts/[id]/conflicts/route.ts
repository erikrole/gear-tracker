import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

const TZ = process.env.INSTITUTION_TZ ?? "America/Chicago";

function toLocalComponents(dt: Date): { day: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(dt);

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

  return {
    day: weekdayMap[weekday] ?? 1,
    hhmm: `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
  };
}

function overlaps(sStart: string, sEnd: string, bStart: string, bEnd: string) {
  return sStart < bEnd && sEnd > bStart;
}

/**
 * GET /api/shifts/[id]/conflicts
 *
 * Returns a map of userId → conflictNote for all active students whose
 * StudentAvailabilityBlock overlaps with this shift's time window.
 * Used to show conflict indicators in the assignment picker UI.
 */
export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "view");
  const { id } = params;

  const shift = await db.shift.findUnique({
    where: { id },
    select: { startsAt: true, endsAt: true },
  });
  if (!shift) throw new HttpError(404, "Shift not found");

  const { day, hhmm: startHhmm } = toLocalComponents(shift.startsAt);
  const { hhmm: endHhmm } = toLocalComponents(shift.endsAt);

  // Only check student availability (FT staff don't have class blocks)
  const blocks = await db.studentAvailabilityBlock.findMany({
    where: { dayOfWeek: day },
    select: { userId: true, startsAt: true, endsAt: true, label: true },
  });

  const conflicts: Record<string, string> = {};
  for (const block of blocks) {
    if (overlaps(startHhmm, endHhmm, block.startsAt, block.endsAt)) {
      const note = block.label
        ? `Conflicts with ${block.label} (${block.startsAt}–${block.endsAt})`
        : `Conflicts with class ${block.startsAt}–${block.endsAt}`;
      conflicts[block.userId] = note;
    }
  }

  return ok({ data: conflicts });
});
