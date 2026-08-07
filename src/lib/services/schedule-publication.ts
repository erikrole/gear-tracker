import { Prisma, Role, ShiftAssignmentStatus, ShiftArea, ShiftWorkerType } from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditEntryTx } from "@/lib/audit";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/booking-statuses";
import { HttpError } from "@/lib/http";
import { workingSchedulePayloadSchema, type WorkingSchedulePayload } from "@/lib/schedule-working-copy";
import { withSerializationRetry } from "@/lib/serialization";
import { checkTimeConflict, findTimeConflict } from "@/lib/services/shift-assignments";
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
          createdAt: true,
        },
      },
      shifts: {
        select: {
          id: true,
          createdAt: true,
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
              _count: {
                select: {
                  bookings: { where: { status: { in: ACTIVE_BOOKING_STATUSES } } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!group) throw new HttpError(404, "Shift group not found");
  return group;
}

export type PublishBlockerCode =
  | "active_trade"
  | "linked_booking"
  | "history_bearing_conversion"
  | "history_bearing_removal"
  | "worker_inactive"
  | "worker_class_mismatch"
  | "time_conflict"
  | "approved_time_off";

export type PublishBlocker = {
  code: PublishBlockerCode;
  message: string;
  slotKey: string | null;
  area: ShiftArea | null;
  workerType: ShiftWorkerType | null;
  userId: string | null;
};

/** Staleness is a separate class: one Refresh clears every instance of it. */
export type PublishStaleness = {
  code: "shift_missing" | "assignment_changed" | "drifted_in" | "published_moved" | "invalid_payload";
  message: string;
};

const availabilityBlockSelect = {
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
} satisfies Prisma.StudentAvailabilityBlockSelect;

type PublicationGroup = Awaited<ReturnType<typeof findGroupForPublication>>;

/**
 * Gather everything standing between a draft and a successful publish.
 *
 * Publish used to throw on the first problem it met, so staff fixed one slot,
 * clicked Publish, met the next, and repeated. Collecting the whole set lets
 * the editor show the work up front and lets one publish attempt report all of
 * it. Staleness is returned separately because a single Refresh clears every
 * instance, and because content checks run against data the draft has already
 * misread once it is stale.
 */
export async function collectPublishBlockers(
  tx: Prisma.TransactionClient,
  group: PublicationGroup,
  payload: WorkingSchedulePayload,
): Promise<{ staleness: PublishStaleness | null; blockers: PublishBlocker[] }> {
  const workingSlots = payload.slots;
  if (!group.workingCopy) return { staleness: null, blockers: [] };
  if (group.workingCopy.basePublishedVersion !== group.publishedVersion) {
    return {
      staleness: {
        code: "published_moved",
        message: "The published schedule changed after this draft started. Refresh and review it before publishing.",
      },
      blockers: [],
    };
  }

  const currentById = new Map(group.shifts.map((shift) => [shift.id, shift]));
  const workingSourceIds = new Set(
    workingSlots.flatMap((slot) => slot.sourceShiftId ? [slot.sourceShiftId] : []),
  );
  const blockers: PublishBlocker[] = [];
  const add = (
    code: PublishBlockerCode,
    message: string,
    slot?: WorkingSchedulePayload["slots"][number],
    userId?: string,
  ) => {
    blockers.push({
      code,
      message,
      slotKey: slot?.key ?? null,
      area: slot?.area ?? null,
      workerType: slot?.workerType ?? null,
      userId: userId ?? null,
    });
  };

  for (const slot of workingSlots) {
    if (!slot.sourceShiftId) continue;
    const current = currentById.get(slot.sourceShiftId);
    if (!current) {
      return {
        staleness: {
          code: "shift_missing",
          message: "A published shift changed after this draft started. Refresh before publishing.",
        },
        blockers: [],
      };
    }
    const assignment = current.assignments[0] ?? null;
    if (slot.assignment?.sourceAssignmentId) {
      if (
        assignment?.id !== slot.assignment.sourceAssignmentId
        || assignment.userId !== slot.assignment.userId
      ) {
        return {
          staleness: {
            code: "assignment_changed",
            message: "An assignment changed after this draft started. Refresh before publishing.",
          },
          blockers: [],
        };
      }
    } else if (assignment && slot.assignment?.sourceAssignmentId !== assignment.id) {
      if (assignment.trades.length > 0) {
        add("active_trade", "Cancel the active trade before publishing this assignment change.", slot, assignment.userId);
      }
      if (assignment._count.bookings > 0) {
        add("linked_booking", "Unlink the assignment's booking before publishing this assignment change.", slot, assignment.userId);
      }
    }
    const explicitlyReplacingCurrentAssignment = Boolean(
      current.assignments[0] && slot.assignment && slot.assignment.sourceAssignmentId === null,
    );
    if (
      slot.workerType !== current.workerType
      && current._count.assignments > 0
      && !explicitlyReplacingCurrentAssignment
    ) {
      add("history_bearing_conversion", "A history-bearing slot cannot be converted. Add a new slot instead.", slot);
    }
  }

  const absent = group.shifts.filter((shift) => !workingSourceIds.has(shift.id));
  // A shift absent from the draft was either removed by the user or added to
  // the live schedule after the snapshot. `baseShiftIds` distinguishes them
  // exactly; drafts predating payloadVersion 2 fall back to the timestamp.
  const draftStartedAt = group.workingCopy.createdAt;
  const baseShiftIds = payload.baseShiftIds ? new Set(payload.baseShiftIds) : null;
  const driftedIn = absent.filter((shift) => baseShiftIds
    ? !baseShiftIds.has(shift.id)
    : shift.createdAt > draftStartedAt);
  if (driftedIn.length > 0) {
    const slots = driftedIn.length === 1 ? "slot was" : "slots were";
    return {
      staleness: {
        code: "drifted_in",
        message: `${driftedIn.length} ${slots} added to this event's live schedule after this draft started, so publishing would delete work this draft never saw. Refresh to pull them into this draft, or discard the draft to keep the live schedule.`,
      },
      blockers: [],
    };
  }
  if (absent.some((shift) => shift._count.assignments > 0)) {
    add("history_bearing_removal", "A history-bearing slot cannot be removed. Add or convert an empty slot instead.");
  }

  // Every worker the publish would touch: an existing assignment whose window
  // moves, and a draft-only assignment that publish will create.
  type Candidate = {
    slot: WorkingSchedulePayload["slots"][number];
    userId: string;
    startsAt: Date;
    endsAt: Date;
    excludeAssignmentId?: string;
    requireClassMatch: boolean;
  };
  const candidates: Candidate[] = [];
  for (const slot of workingSlots) {
    const workingAssignment = slot.assignment;
    if (!workingAssignment) continue;
    if (workingAssignment.sourceAssignmentId && slot.sourceShiftId) {
      const current = currentById.get(slot.sourceShiftId);
      const assignment = current?.assignments[0];
      if (!current || !assignment || assignment.id !== workingAssignment.sourceAssignmentId) continue;
      const beforeWindow = effectiveCurrentWindow(current, assignment);
      const afterWindow = effectiveWorkingWindow(slot);
      if (beforeWindow.startsAt === afterWindow.startsAt && beforeWindow.endsAt === afterWindow.endsAt) continue;
      candidates.push({
        slot,
        userId: workingAssignment.userId,
        startsAt: new Date(afterWindow.startsAt),
        endsAt: new Date(afterWindow.endsAt),
        excludeAssignmentId: assignment.id,
        requireClassMatch: false,
      });
    } else if (!workingAssignment.sourceAssignmentId) {
      const window = effectiveWorkingWindow(slot);
      candidates.push({
        slot,
        userId: workingAssignment.userId,
        startsAt: new Date(window.startsAt),
        endsAt: new Date(window.endsAt),
        requireClassMatch: true,
      });
    }
  }

  if (candidates.length > 0) {
    const users = await tx.user.findMany({
      where: { id: { in: [...new Set(candidates.map((candidate) => candidate.userId))] } },
      select: {
        id: true,
        name: true,
        active: true,
        staffingType: true,
        availabilityBlocks: { select: availabilityBlockSelect },
      },
    });
    const userById = new Map(users.map((user) => [user.id, user]));
    for (const candidate of candidates) {
      const user = userById.get(candidate.userId);
      if (!user?.active) {
        add("worker_inactive", "An assigned worker is no longer active.", candidate.slot, candidate.userId);
        continue;
      }
      if (candidate.requireClassMatch && user.staffingType !== candidate.slot.workerType) {
        add(
          "worker_class_mismatch",
          `${user.name} no longer matches this slot's scheduling class.`,
          candidate.slot,
          user.id,
        );
      }
      const conflict = await findTimeConflict(
        tx,
        user.id,
        candidate.startsAt,
        candidate.endsAt,
        candidate.excludeAssignmentId,
      );
      if (conflict) add("time_conflict", `${user.name}: ${conflict}`, candidate.slot, user.id);
      if (candidate.slot.workerType === "ST") {
        const availability = evaluateAvailabilityPreferences(user.availabilityBlocks, {
          startsAt: candidate.startsAt,
          endsAt: candidate.endsAt,
        });
        if (availability.blocking) {
          add("approved_time_off", `${user.name}: ${availability.blocking.note}`, candidate.slot, user.id);
        }
      }
    }
  }

  return { staleness: null, blockers };
}

/** Read-only preflight for the editor, so blockers surface before Publish. */
export async function getPublishPreflight(shiftGroupId: string) {
  const group = await findGroupForPublication(shiftGroupId);
  if (!group.workingCopy) return { staleness: null, blockers: [] as PublishBlocker[] };
  const parsed = workingSchedulePayloadSchema.safeParse(group.workingCopy.payload);
  if (!parsed.success) {
    return {
      staleness: {
        code: "invalid_payload" as const,
        message: "This working schedule is invalid and cannot be published.",
      },
      blockers: [] as PublishBlocker[],
    };
  }
  return collectPublishBlockers(db, group, parsed.data);
}

export async function publishShiftGroup(
  shiftGroupId: string,
  actorId: string,
  expectedWorkingVersion?: number,
  actorRole?: Role,
) {
  return withSerializationRetry(() => db.$transaction(async (tx) => {
    let group = await findGroupForPublication(shiftGroupId, tx);
    const before = getSchedulePublicationState(group);
    const workingVersion = group.workingCopy?.version ?? null;
    const affectedUserIds = new Set<string>();

    if (group.workingCopy) {
      if (expectedWorkingVersion !== group.workingCopy.version) {
        throw new HttpError(409, "This working schedule changed. Refresh and review the latest version before publishing.");
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

      // Everything that can block this publish, gathered before a single row is
      // written, so one attempt reports the whole list instead of making staff
      // rediscover it one exception at a time.
      const preflight = await collectPublishBlockers(tx, group, parsed.data);
      if (preflight.staleness) {
        throw new HttpError(409, preflight.staleness.message, { staleness: preflight.staleness });
      }
      if (preflight.blockers.length === 1) {
        throw new HttpError(409, preflight.blockers[0]!.message, { blockers: preflight.blockers });
      }
      if (preflight.blockers.length > 1) {
        throw new HttpError(
          409,
          `${preflight.blockers.length} problems block publishing this schedule. Resolve them and publish again.`,
          { blockers: preflight.blockers },
        );
      }

      for (const slot of workingSlots) {
        if (!slot.sourceShiftId) continue;
        const current = currentById.get(slot.sourceShiftId);
        const assignment = current?.assignments[0] ?? null;
        if (assignment && !slot.assignment?.sourceAssignmentId) {
          affectedUserIds.add(assignment.userId);
        }
      }

      const absent = group.shifts.filter((shift) => !workingSourceIds.has(shift.id));
      const removed = absent;

      const changedAssignedWindows = workingSlots.flatMap((slot) => {
        const workingAssignment = slot.assignment;
        if (!slot.sourceShiftId || !workingAssignment?.sourceAssignmentId) return [];
        const current = currentById.get(slot.sourceShiftId);
        const assignment = current?.assignments[0];
        if (!current || !assignment || assignment.id !== workingAssignment.sourceAssignmentId) return [];
        const beforeWindow = effectiveCurrentWindow(current, assignment);
        const afterWindow = effectiveWorkingWindow(slot);
        const windowChanged = beforeWindow.startsAt !== afterWindow.startsAt
          || beforeWindow.endsAt !== afterWindow.endsAt;
        const assignmentFieldsChanged = iso(assignment.callStartsAt) !== workingAssignment.callStartsAt
          || iso(assignment.callEndsAt) !== workingAssignment.callEndsAt
          || (assignment.callNote ?? null) !== workingAssignment.callNote;
        if (!windowChanged && !assignmentFieldsChanged) return [];
        return [{ slot, assignment, workingAssignment, afterWindow, windowChanged, assignmentFieldsChanged }];
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
        for (const { slot, assignment, workingAssignment, afterWindow, windowChanged, assignmentFieldsChanged } of changedAssignedWindows) {
          const user = userById.get(assignment.userId);
          if (!user?.active) throw new HttpError(409, "An assigned worker is no longer active.");
          if (windowChanged) {
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
          }
          const data = {
            ...(assignmentFieldsChanged ? {
              callStartsAt: workingAssignment.callStartsAt ? new Date(workingAssignment.callStartsAt) : null,
              callEndsAt: workingAssignment.callEndsAt ? new Date(workingAssignment.callEndsAt) : null,
              callNote: workingAssignment.callNote,
            } : {}),
            acknowledgedAt: null,
            acknowledgedById: null,
          };
          await tx.shiftAssignment.update({
            where: { id: assignment.id },
            data,
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
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
