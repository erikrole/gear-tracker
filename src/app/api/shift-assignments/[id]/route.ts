import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { removeAssignment } from "@/lib/services/shift-assignments";
import { createAuditEntry } from "@/lib/audit";
import { updateShiftAssignmentSchema } from "@/lib/validation";
import { assertCallTimePair, assertDateOrder, parseOptionalDate } from "@/lib/api-dates";
import { createShiftScheduleNotification } from "@/lib/services/notifications";
import { availabilityConflictNote } from "@/lib/student-availability";

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift_assignment", "assign");
  const { id } = await params;

  const body = updateShiftAssignmentSchema.parse(await req.json());
  const existing = await db.shiftAssignment.findUnique({
    where: { id },
    include: {
      shift: true,
      user: {
        select: {
          role: true,
          availabilityBlocks: {
            select: {
              kind: true,
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
  if (!existing) throw new HttpError(404, "Assignment not found");

  const callStartsAt = parseOptionalDate(body.callStartsAt ?? undefined, "callStartsAt");
  const callEndsAt = parseOptionalDate(body.callEndsAt ?? undefined, "callEndsAt");
  // Require both fields together — partial pairs break conflict detection
  if ((body.callStartsAt !== undefined) !== (body.callEndsAt !== undefined)) {
    throw new HttpError(400, "callStartsAt and callEndsAt must both be provided or both omitted");
  }
  assertCallTimePair(callStartsAt, callEndsAt);
  assertDateOrder(callStartsAt, callEndsAt, "callEndsAt must be after callStartsAt", { allowEqual: false });

  const data: Record<string, unknown> = {};
  if (body.callStartsAt !== undefined) data.callStartsAt = callStartsAt;
  if (body.callEndsAt !== undefined) data.callEndsAt = callEndsAt;
  if (body.callNote !== undefined) data.callNote = body.callNote;
  if (body.notes !== undefined) data.notes = body.notes;
  if (existing.shift && existing.user) {
    const effectiveStartsAt = (body.callStartsAt !== undefined ? callStartsAt : existing.callStartsAt)
      ?? existing.shift.callStartsAt
      ?? existing.shift.startsAt;
    const effectiveEndsAt = (body.callEndsAt !== undefined ? callEndsAt : existing.callEndsAt)
      ?? existing.shift.callEndsAt
      ?? existing.shift.endsAt;
    const conflictNote = existing.user.role === "STUDENT"
      ? availabilityConflictNote(existing.user.availabilityBlocks, {
          startsAt: effectiveStartsAt,
          endsAt: effectiveEndsAt,
        })
      : null;
    data.hasConflict = Boolean(conflictNote);
    data.conflictNote = conflictNote;
  }

  const assignment = await db.shiftAssignment.update({ where: { id }, data });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: id,
    action: "shift_assignment_updated",
    before: {
      callStartsAt: existing.callStartsAt,
      callEndsAt: existing.callEndsAt,
      callNote: existing.callNote,
    },
    after: {
      callStartsAt: assignment.callStartsAt,
      callEndsAt: assignment.callEndsAt,
      callNote: assignment.callNote,
    },
  });

  if (body.callStartsAt !== undefined || body.callEndsAt !== undefined || body.callNote !== undefined) {
    createShiftScheduleNotification(id, "personal_call_time_changed").catch(() => {});
  }

  return ok({ data: assignment });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift_assignment", "assign");
  const { id } = await params;

  const assignment = await removeAssignment(id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift_assignment",
    entityId: id,
    action: "shift_assignment_removed",
  });

  createShiftScheduleNotification(id, "removed").catch(() => {});

  return ok({ data: assignment });
});
