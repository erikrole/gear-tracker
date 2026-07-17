import { Prisma } from "@prisma/client";
import { after } from "next/server";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateShiftSchema } from "@/lib/validation";
import { createAuditEntry, createAuditEntryTx } from "@/lib/audit";
import { assertCallTimePair, assertDateOrder, parseOptionalDate } from "@/lib/api-dates";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import { availabilityConflictNote } from "@/lib/student-availability";
import { shiftWorkerTypeForProfile } from "@/lib/shift-display";
import { updateShiftAssignmentConflictsTx } from "@/lib/services/shift-assignment-conflicts";
import { scheduleShiftTimeChangedNotifications } from "@/lib/shift-notification-workflow";

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "edit");
  const { id } = params;

  const body = updateShiftSchema.parse(await req.json());
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

  const changesTimeWindow = body.startsAt !== undefined
    || body.endsAt !== undefined
    || body.callStartsAt !== undefined
    || body.callEndsAt !== undefined;

  const { updated, assignmentIds } = await db.$transaction(async (tx) => {
    const existing = await tx.shift.findUnique({
      where: { id },
      include: { shiftGroup: { select: { publishedAt: true } } },
    });
    if (!existing) throw new HttpError(404, "Shift not found");

    // Validate one-bound edits against the row visible to this transaction.
    const mergedStartsAt = startsAt ?? existing.startsAt;
    const mergedEndsAt = endsAt ?? existing.endsAt;
    if (mergedEndsAt <= mergedStartsAt) {
      throw new HttpError(400, "endsAt must be after startsAt");
    }

    const result = await tx.shift.update({ where: { id }, data });
    const changedAssignmentIds: string[] = [];

    if (changesTimeWindow) {
      const assignments = await tx.shiftAssignment.findMany({
        where: { shiftId: id, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
        select: {
          id: true,
          callStartsAt: true,
          callEndsAt: true,
          user: {
            select: {
              role: true,
              staffingType: true,
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
      const conflictRefreshes = assignments.map((assignment) => {
        const effectiveStartsAt = assignment.callStartsAt ?? result.callStartsAt ?? result.startsAt;
        const effectiveEndsAt = assignment.callEndsAt ?? result.callEndsAt ?? result.endsAt;
        const conflictNote = shiftWorkerTypeForProfile(assignment.user) === "ST"
          ? availabilityConflictNote(assignment.user.availabilityBlocks, {
              startsAt: effectiveStartsAt,
              endsAt: effectiveEndsAt,
            })
          : null;
        return {
          id: assignment.id,
          hasConflict: Boolean(conflictNote),
          conflictNote,
        };
      });
      await updateShiftAssignmentConflictsTx(
        tx,
        conflictRefreshes,
        existing.shiftGroup.publishedAt !== null,
      );
      changedAssignmentIds.push(...assignments.map((assignment) => assignment.id));
    }

    await createAuditEntryTx(tx, {
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
        startsAt: result.startsAt,
        endsAt: result.endsAt,
        callStartsAt: result.callStartsAt,
        callEndsAt: result.callEndsAt,
      },
    });

    return { updated: result, assignmentIds: changedAssignmentIds };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (assignmentIds.length > 0) {
    after(() => scheduleShiftTimeChangedNotifications(assignmentIds));
  }

  return ok({ data: updated });
});

export const DELETE = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "delete");
  const { id } = params;

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.shift.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
          select: { id: true },
        },
      },
    });
    if (!existing) throw new HttpError(404, "Shift not found");

    // Match the shift-group delete contract: staffed shifts need an explicit force
    if (existing.assignments.length > 0 && !force) {
      throw new HttpError(
        409,
        "This shift has active assignments. Use ?force=true to remove anyway.",
      );
    }

    await tx.shiftTrade.updateMany({
      where: {
        shiftAssignment: { shiftId: id },
        status: { in: ["OPEN", "CLAIMED"] },
      },
      data: { status: "CANCELLED", resolvedAt: new Date() },
    });

    await tx.shift.delete({ where: { id } });

    return {
      area: existing.area,
      workerType: existing.workerType,
      activeAssignmentCount: existing.assignments.length,
    };
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift",
    entityId: id,
    action: "shift_deleted",
    before: {
      area: result.area,
      workerType: result.workerType,
      force,
      activeAssignmentCount: result.activeAssignmentCount,
    },
  });

  return ok({ success: true });
});
