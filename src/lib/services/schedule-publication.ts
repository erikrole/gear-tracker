import { Prisma, Role, ShiftAssignmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
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
  if (!group) throw new HttpError(404, "Shift group not found");
  return group;
}

export async function publishShiftGroup(shiftGroupId: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const group = await findGroupForPublication(shiftGroupId, tx);
    const before = getSchedulePublicationState(group);
    const snapshot = buildSchedulePublicationSnapshot(group);
    const publishedAt = new Date();
    const updated = await tx.shiftGroup.update({
      where: { id: shiftGroupId },
      data: {
        publishedAt,
        publishedById: actorId,
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

    return {
      shiftGroupId,
      before,
      after: getSchedulePublicationState(updated),
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
