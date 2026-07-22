import { Prisma, Role, ShiftAssignmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditEntryTx } from "@/lib/audit";
import { HttpError } from "@/lib/http";
import { workingSchedulePayloadSchema } from "@/lib/schedule-working-copy";
import { checkTimeConflict } from "@/lib/services/shift-assignments";
import { evaluateAvailabilityPreferences } from "@/lib/student-availability";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import type {
  SchedulePublicationSnapshot,
  SchedulePublicationState,
} from "@/lib/schedule-publication-types";

type SnapshotShift = {
  id: string;
  area: string;
  workerType: string;
  startsAt: Date | string;
  endsAt: Date | string;
  callStartsAt?: Date | string | null;
  callEndsAt?: Date | string | null;
  assignments: Array<{
    id: string;
    userId: string;
    status: ShiftAssignmentStatus | string;
    callStartsAt?: Date | string | null;
    callEndsAt?: Date | string | null;
    callNote?: string | null;
    acknowledgedAt?: Date | string | null;
  }>;
};

type SnapshotGroup = {
  publishedAt?: Date | string | null;
  publishedById?: string | null;
  lastPublishedSnapshot?: Prisma.JsonValue | null;
  shifts: SnapshotShift[];
};

const ACTIVE_STATUS_SET = new Set<string>(ACTIVE_ASSIGNMENT_STATUSES);

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function effectiveWorkingWindow(slot: {
  startsAt: string;
  endsAt: string;
  callStartsAt: string | null;
  callEndsAt: string | null;
  assignment: { callStartsAt: string | null; callEndsAt: string | null } | null;
}) {
  return {
    startsAt: slot.assignment?.callStartsAt ?? slot.callStartsAt ?? slot.startsAt,
    endsAt: slot.assignment?.callEndsAt ?? slot.callEndsAt ?? slot.endsAt,
  };
}

function effectiveCurrentWindow(
  shift: SnapshotShift,
  assignment: SnapshotShift["assignments"][number],
) {
  return {
    startsAt: iso(assignment.callStartsAt) ?? iso(shift.callStartsAt) ?? iso(shift.startsAt)!,
    endsAt: iso(assignment.callEndsAt) ?? iso(shift.callEndsAt) ?? iso(shift.endsAt)!,
  };
}

function normalizeStoredSnapshot(value: Prisma.JsonValue | null | undefined): SchedulePublicationSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { shifts?: unknown };
  if (!Array.isArray(candidate.shifts)) return null;
  return value as SchedulePublicationSnapshot;
}

export function buildSchedulePublicationSnapshot(group: { shifts: SnapshotShift[] }): SchedulePublicationSnapshot {
  return {
    shifts: group.shifts
      .map((shift) => ({
        shiftId: shift.id,
        area: shift.area,
        workerType: shift.workerType,
        startsAt: iso(shift.startsAt)!,
        endsAt: iso(shift.endsAt)!,
        callStartsAt: iso(shift.callStartsAt),
        callEndsAt: iso(shift.callEndsAt),
        assignments: shift.assignments
          .filter((assignment) => ACTIVE_STATUS_SET.has(assignment.status))
          .map((assignment) => ({
            id: assignment.id,
            userId: assignment.userId,
            status: assignment.status,
            callStartsAt: iso(assignment.callStartsAt),
            callEndsAt: iso(assignment.callEndsAt),
            callNote: assignment.callNote ?? null,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)
        || a.area.localeCompare(b.area)
        || a.workerType.localeCompare(b.workerType)
        || a.shiftId.localeCompare(b.shiftId)),
  };
}

export function getSchedulePublicationState(group: SnapshotGroup): SchedulePublicationState {
  const activeAssignments = group.shifts.flatMap((shift) =>
    shift.assignments.filter((assignment) => ACTIVE_STATUS_SET.has(assignment.status)),
  );
  const publishedAt = iso(group.publishedAt);
  const publishedSnapshot = normalizeStoredSnapshot(group.lastPublishedSnapshot);
  const currentSnapshot = buildSchedulePublicationSnapshot(group);
  const changedAfterPublish = Boolean(
    publishedAt
    && (!publishedSnapshot || stableJson(publishedSnapshot) !== stableJson(currentSnapshot)),
  );
  const acknowledgedCount = publishedAt
    ? activeAssignments.filter((assignment) => {
        const acknowledgedAt = iso(assignment.acknowledgedAt);
        return acknowledgedAt !== null && acknowledgedAt >= publishedAt;
      }).length
    : 0;

  return {
    status: !publishedAt ? "draft" : changedAfterPublish ? "changed" : "published",
    publishedAt,
    publishedById: group.publishedById ?? null,
    changedAfterPublish,
    activeAssignmentCount: activeAssignments.length,
    acknowledgedCount,
    unacknowledgedCount: publishedAt ? activeAssignments.length - acknowledgedCount : 0,
  };
}

async function findGroupForPublication(shiftGroupId: string, tx: Prisma.TransactionClient = db) {
  const group = await tx.shiftGroup.findUnique({
    where: { id: shiftGroupId },
    select: {
      id: true,
      publishedAt: true,
      publishedById: true,
      lastPublishedSnapshot: true,
      publishedVersion: true,
      workingCopy: {
        select: {
          version: true,
          basePublishedVersion: true,
          payload: true,
        },
      },
      shifts: {
        select: {
          id: true,
          area: true,
          workerType: true,
          startsAt: true,
          endsAt: true,
          callStartsAt: true,
          callEndsAt: true,
          notes: true,
          _count: { select: { assignments: true } },
          assignments: {
            where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[] } },
            select: {
              id: true,
              userId: true,
              status: true,
              callStartsAt: true,
              callEndsAt: true,
              callNote: true,
              acknowledgedAt: true,
              trades: {
                where: { status: { in: ["OPEN", "CLAIMED"] } },
                select: { id: true },
                take: 1,
              },
              _count: { select: { bookings: true } },
            },
          },
        },
      },
    },
  });
  if (!group) throw new HttpError(404, "Shift group not found");
  return group;
}

export async function publishShiftGroup(
  shiftGroupId: string,
  actorId: string,
  expectedWorkingVersion?: number,
  actorRole?: Role,
) {
  return db.$transaction(async (tx) => {
    let group = await findGroupForPublication(shiftGroupId, tx);
    const before = getSchedulePublicationState(group);
    const workingVersion = group.workingCopy?.version ?? null;
    const affectedUserIds = new Set<string>();

    if (group.workingCopy) {
      if (expectedWorkingVersion !== group.workingCopy.version) {
        throw new HttpError(409, "This working schedule changed. Refresh and review the latest version before publishing.");
      }
      if (group.workingCopy.basePublishedVersion !== group.publishedVersion) {
        throw new HttpError(409, "The published schedule changed after this draft started. Refresh and review it before publishing.");
      }
      const parsed = workingSchedulePayloadSchema.safeParse(group.workingCopy.payload);
      if (!parsed.success) {
        throw new HttpError(409, "This working schedule is invalid and cannot be published.");
      }

      const workingSlots = parsed.data.slots;
      const currentById = new Map(group.shifts.map((shift) => [shift.id, shift]));
      const workingSourceIds = new Set(
        workingSlots.flatMap((slot) => slot.sourceShiftId ? [slot.sourceShiftId] : []),
      );

      for (const slot of workingSlots) {
        if (!slot.sourceShiftId) {
          if (slot.assignment) {
            throw new HttpError(409, "Assign new working slots before publishing them through the assignment workflow.");
          }
          continue;
        }
        const current = currentById.get(slot.sourceShiftId);
        if (!current) {
          throw new HttpError(409, "A published shift changed after this draft started. Refresh before publishing.");
        }
        const assignment = current.assignments[0] ?? null;
        if (slot.assignment?.sourceAssignmentId) {
          if (
            assignment?.id !== slot.assignment.sourceAssignmentId
            || assignment.userId !== slot.assignment.userId
            || assignment.callStartsAt?.toISOString() !== (slot.assignment.callStartsAt ?? undefined)
            || assignment.callEndsAt?.toISOString() !== (slot.assignment.callEndsAt ?? undefined)
            || (assignment.callNote ?? null) !== slot.assignment.callNote
          ) {
            throw new HttpError(409, "An assignment changed after this draft started. Refresh before publishing.");
          }
        } else if (assignment && slot.assignment?.sourceAssignmentId !== assignment.id) {
          if (assignment.trades.length > 0) {
            throw new HttpError(409, "Cancel the active trade before publishing this assignment change.");
          }
          if (assignment._count.bookings > 0) {
            throw new HttpError(409, "Unlink the assignment's booking before publishing this assignment change.");
          }
          affectedUserIds.add(assignment.userId);
        }
        if (slot.workerType !== current.workerType && current._count.assignments > 0) {
          throw new HttpError(409, "A history-bearing slot cannot be converted. Add a new slot instead.");
        }
      }

      const removed = group.shifts.filter((shift) => !workingSourceIds.has(shift.id));
      if (removed.some((shift) => shift._count.assignments > 0)) {
        throw new HttpError(409, "A history-bearing slot cannot be removed. Add or convert an empty slot instead.");
      }

      const changedAssignedWindows = workingSlots.flatMap((slot) => {
        if (!slot.sourceShiftId || !slot.assignment?.sourceAssignmentId) return [];
        const current = currentById.get(slot.sourceShiftId);
        const assignment = current?.assignments[0];
        if (!current || !assignment || assignment.id !== slot.assignment.sourceAssignmentId) return [];
        const beforeWindow = effectiveCurrentWindow(current, assignment);
        const afterWindow = effectiveWorkingWindow(slot);
        if (beforeWindow.startsAt === afterWindow.startsAt && beforeWindow.endsAt === afterWindow.endsAt) return [];
        return [{ slot, assignment, afterWindow }];
      });
      if (changedAssignedWindows.length > 0) {
        const userIds = [...new Set(changedAssignedWindows.map(({ assignment }) => assignment.userId))];
        const users = await tx.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            active: true,
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
        });
        const userById = new Map(users.map((user) => [user.id, user]));
        for (const { slot, assignment, afterWindow } of changedAssignedWindows) {
          const user = userById.get(assignment.userId);
          if (!user?.active) throw new HttpError(409, "An assigned worker is no longer active.");
          await checkTimeConflict(
            tx,
            user.id,
            new Date(afterWindow.startsAt),
            new Date(afterWindow.endsAt),
            assignment.id,
          );
          if (slot.workerType === "ST") {
            const availability = evaluateAvailabilityPreferences(user.availabilityBlocks, {
              startsAt: new Date(afterWindow.startsAt),
              endsAt: new Date(afterWindow.endsAt),
            });
            if (availability.blocking) throw new HttpError(409, availability.blocking.note);
          }
          await tx.shiftAssignment.update({
            where: { id: assignment.id },
            data: { acknowledgedAt: null, acknowledgedById: null },
          });
          affectedUserIds.add(user.id);
        }
      }

      for (const slot of workingSlots) {
        if (!slot.sourceShiftId) continue;
        const current = currentById.get(slot.sourceShiftId)!;
        const unchanged = current.area === slot.area
          && current.workerType === slot.workerType
          && current.startsAt.toISOString() === slot.startsAt
          && current.endsAt.toISOString() === slot.endsAt
          && current.callStartsAt?.toISOString() === (slot.callStartsAt ?? undefined)
          && current.callEndsAt?.toISOString() === (slot.callEndsAt ?? undefined)
          && (current.notes ?? null) === slot.notes;
        if (unchanged) continue;
        await tx.shift.update({
          where: { id: slot.sourceShiftId },
          data: {
            area: slot.area,
            workerType: slot.workerType,
            startsAt: new Date(slot.startsAt),
            endsAt: new Date(slot.endsAt),
            callStartsAt: slot.callStartsAt ? new Date(slot.callStartsAt) : null,
            callEndsAt: slot.callEndsAt ? new Date(slot.callEndsAt) : null,
            notes: slot.notes,
            templateManaged: false,
          },
        });
      }

      const added = workingSlots.filter((slot) => !slot.sourceShiftId);
      const shiftIdByWorkingKey = new Map(
        workingSlots.flatMap((slot) => slot.sourceShiftId ? [[slot.key, slot.sourceShiftId] as const] : []),
      );
      for (const slot of added) {
        const created = await tx.shift.create({
          data: {
            shiftGroupId,
            area: slot.area,
            workerType: slot.workerType,
            startsAt: new Date(slot.startsAt),
            endsAt: new Date(slot.endsAt),
            callStartsAt: slot.callStartsAt ? new Date(slot.callStartsAt) : null,
            callEndsAt: slot.callEndsAt ? new Date(slot.callEndsAt) : null,
            notes: slot.notes,
          },
          select: { id: true },
        });
        shiftIdByWorkingKey.set(slot.key, created.id);
      }

      for (const slot of workingSlots) {
        if (!slot.sourceShiftId) continue;
        const currentAssignment = currentById.get(slot.sourceShiftId)?.assignments[0] ?? null;
        if (currentAssignment && slot.assignment?.sourceAssignmentId !== currentAssignment.id) {
          await tx.shiftAssignment.update({
            where: { id: currentAssignment.id },
            data: {
              status: "DECLINED",
              acknowledgedAt: null,
              acknowledgedById: null,
            },
          });
        }
      }

      if (removed.length > 0) {
        await tx.shift.deleteMany({ where: { id: { in: removed.map((shift) => shift.id) } } });
      }

      const draftAssignments = workingSlots.flatMap((slot) =>
        slot.assignment && !slot.assignment.sourceAssignmentId
          ? [{ slot, assignment: slot.assignment }]
          : [],
      );
      if (draftAssignments.length > 0) {
        const userIds = [...new Set(draftAssignments.map(({ assignment }) => assignment.userId))];
        const users = await tx.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            active: true,
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
        });
        const userById = new Map(users.map((user) => [user.id, user]));
        for (const { slot, assignment } of draftAssignments) {
          const user = userById.get(assignment.userId);
          if (!user?.active) throw new HttpError(409, "An assigned worker is no longer active.");
          if (user.staffingType !== slot.workerType) {
            throw new HttpError(409, "An assigned worker no longer matches the slot's scheduling class.");
          }
          const startsAt = new Date(assignment.callStartsAt ?? slot.callStartsAt ?? slot.startsAt);
          const endsAt = new Date(assignment.callEndsAt ?? slot.callEndsAt ?? slot.endsAt);
          await checkTimeConflict(tx, user.id, startsAt, endsAt);
          if (slot.workerType === "ST") {
            const availability = evaluateAvailabilityPreferences(user.availabilityBlocks, { startsAt, endsAt });
            if (availability.blocking) throw new HttpError(409, availability.blocking.note);
          }
          const shiftId = shiftIdByWorkingKey.get(slot.key);
          if (!shiftId) throw new HttpError(409, "A working slot could not be reconciled.");
          await tx.shiftAssignment.updateMany({
            where: { shiftId, status: "REQUESTED" },
            data: { status: "DECLINED" },
          });
          await tx.shiftAssignment.create({
            data: {
              shiftId,
              userId: user.id,
              status: "DIRECT_ASSIGNED",
              assignedBy: actorId,
              callStartsAt: assignment.callStartsAt ? new Date(assignment.callStartsAt) : null,
              callEndsAt: assignment.callEndsAt ? new Date(assignment.callEndsAt) : null,
              callNote: assignment.callNote,
            },
          });
          affectedUserIds.add(user.id);
        }
      }
      await tx.shiftGroup.update({ where: { id: shiftGroupId }, data: { manuallyEdited: true } });
      group = await findGroupForPublication(shiftGroupId, tx);
    }

    const snapshot = buildSchedulePublicationSnapshot(group);
    const previousSnapshot = normalizeStoredSnapshot(group.lastPublishedSnapshot);
    const publishedSnapshotChanged = !previousSnapshot || stableJson(previousSnapshot) !== stableJson(snapshot);
    const publishedAt = new Date();
    const updated = await tx.shiftGroup.update({
      where: { id: shiftGroupId },
      data: {
        publishedAt,
        publishedById: actorId,
        publishedVersion: { increment: 1 },
        lastPublishedSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        publishedAt: true,
        publishedById: true,
        lastPublishedSnapshot: true,
        shifts: {
          select: {
            id: true,
            area: true,
            workerType: true,
            startsAt: true,
            endsAt: true,
            callStartsAt: true,
            callEndsAt: true,
            assignments: {
              where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES as ShiftAssignmentStatus[] } },
              select: {
                id: true,
                userId: true,
                status: true,
                callStartsAt: true,
                callEndsAt: true,
                callNote: true,
                acknowledgedAt: true,
              },
            },
          },
        },
      },
    });

    if (workingVersion !== null) {
      const deleted = await tx.shiftGroupWorkingCopy.deleteMany({
        where: { shiftGroupId, version: workingVersion },
      });
      if (deleted.count !== 1) {
        throw new HttpError(409, "This schedule changed while it was being published. Refresh and try again.");
      }
    }

    const after = getSchedulePublicationState(updated);
    if (actorRole) {
      await createAuditEntryTx(tx, {
        actorId,
        actorRole,
        entityType: "shift_group",
        entityId: shiftGroupId,
        action: before.publishedAt ? "shift_group_republished" : "shift_group_published",
        before,
        after,
      });
    }

    return {
      shiftGroupId,
      workingVersion,
      affectedUserIds: [...affectedUserIds],
      publishedSnapshotChanged,
      before,
      after,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function acknowledgeShiftAssignment(
  assignmentId: string,
  actor: { id: string; role: Role },
) {
  return db.$transaction(async (tx) => {
    const assignment = await tx.shiftAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        userId: true,
        status: true,
        acknowledgedAt: true,
        shift: {
          select: {
            shiftGroup: {
              select: {
                id: true,
                publishedAt: true,
              },
            },
          },
        },
      },
    });
    if (!assignment) throw new HttpError(404, "Assignment not found");
    if (!ACTIVE_STATUS_SET.has(assignment.status)) {
      throw new HttpError(400, "Only active assignments can be acknowledged");
    }
    if (!assignment.shift.shiftGroup.publishedAt) {
      throw new HttpError(400, "This schedule has not been published yet");
    }
    if (assignment.userId !== actor.id) {
      throw new HttpError(403, "Only the assigned worker can acknowledge this shift");
    }

    const acknowledgedAt = new Date();
    const updated = await tx.shiftAssignment.update({
      where: { id: assignmentId },
      data: {
        acknowledgedAt,
        acknowledgedById: actor.id,
      },
      select: {
        id: true,
        shiftId: true,
        userId: true,
        status: true,
        acknowledgedAt: true,
        acknowledgedById: true,
      },
    });

    return {
      before: {
        acknowledgedAt: assignment.acknowledgedAt,
      },
      after: updated,
      shiftGroupId: assignment.shift.shiftGroup.id,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
