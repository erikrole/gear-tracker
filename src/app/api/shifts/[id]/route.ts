import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateShiftSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";
import { assertCallTimePair, assertDateOrder, parseOptionalDate } from "@/lib/api-dates";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import { createShiftScheduleNotification } from "@/lib/services/notifications";
import { availabilityConflictNote } from "@/lib/student-availability";

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "edit");
  const { id } = params;

  const body = updateShiftSchema.parse(await req.json());
  const existing = await db.shift.findUnique({
    where: { id },
    include: { shiftGroup: { select: { publishedAt: true } } },
  });
  if (!existing) throw new HttpError(404, "Shift not found");

  const data: Record<string, unknown> = {};
  const startsAt = parseOptionalDate(body.startsAt, "startsAt");
  const endsAt = parseOptionalDate(body.endsAt, "endsAt");
  const callStartsAt = parseOptionalDate(body.callStartsAt ?? undefined, "callStartsAt");
  const callEndsAt = parseOptionalDate(body.callEndsAt ?? undefined, "callEndsAt");
  if ((body.callStartsAt !== undefined) !== (body.callEndsAt !== undefined)) {
    throw new HttpError(400, "callStartsAt and callEndsAt must both be provided or both omitted");
  }
  assertCallTimePair(callStartsAt, callEndsAt);
  assertDateOrder(startsAt, endsAt, "endsAt must be after startsAt", { allowEqual: false });
  assertDateOrder(callStartsAt, callEndsAt, "callEndsAt must be after callStartsAt", { allowEqual: false });

  if (startsAt) data.startsAt = startsAt;
  if (endsAt) data.endsAt = endsAt;
  if (body.callStartsAt !== undefined) data.callStartsAt = callStartsAt;
  if (body.callEndsAt !== undefined) data.callEndsAt = callEndsAt;
  if (body.notes !== undefined) data.notes = body.notes;

  const updated = await db.shift.update({ where: { id }, data });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift",
    entityId: id,
    action: "shift_updated",
    before: {
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
      callStartsAt: existing.callStartsAt,
      callEndsAt: existing.callEndsAt,
    },
    after: {
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
      callStartsAt: updated.callStartsAt,
      callEndsAt: updated.callEndsAt,
    },
  });

  if (body.startsAt !== undefined || body.endsAt !== undefined || body.callStartsAt !== undefined || body.callEndsAt !== undefined) {
    const assignments = await db.shiftAssignment.findMany({
      where: { shiftId: id, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
      select: {
        id: true,
        callStartsAt: true,
        callEndsAt: true,
        user: {
          select: {
            role: true,
            availabilityBlocks: {
              select: {
                kind: true,
                intent: true,
                status: true,
                dayOfWeek: true,
                date: true,
                startsAt: true,
                endsAt: true,
                label: true,
                semesterLabel: true,
                semesterStartsOn: true,
                semesterEndsOn: true,
              },
            },
          },
        },
      },
    });
    for (const assignment of assignments) {
      const effectiveStartsAt = assignment.callStartsAt ?? updated.callStartsAt ?? updated.startsAt;
      const effectiveEndsAt = assignment.callEndsAt ?? updated.callEndsAt ?? updated.endsAt;
      const conflictNote = assignment.user?.role === "STUDENT"
        ? availabilityConflictNote(assignment.user.availabilityBlocks, {
            startsAt: effectiveStartsAt,
            endsAt: effectiveEndsAt,
          })
        : null;
      if (assignment.user) {
        await db.shiftAssignment.update({
          where: { id: assignment.id },
          data: {
            hasConflict: Boolean(conflictNote),
            conflictNote,
            ...(existing.shiftGroup.publishedAt
              ? { acknowledgedAt: null, acknowledgedById: null }
              : {}),
          },
        });
      }
      createShiftScheduleNotification(assignment.id, "shift_time_changed").catch(() => {});
    }
  }

  return ok({ data: updated });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "delete");
  const { id } = params;

  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Shift not found");

  await db.shift.delete({ where: { id } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift",
    entityId: id,
    action: "shift_deleted",
    before: { area: existing.area, workerType: existing.workerType },
  });

  return ok({ success: true });
});
