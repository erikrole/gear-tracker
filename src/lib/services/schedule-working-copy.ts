import { randomUUID } from "node:crypto";
import { Prisma, Role, ShiftAssignmentStatus } from "@prisma/client";
import { createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import {
  applyWorkingScheduleCommand,
  summarizeWorkingScheduleChanges,
  type WorkingScheduleCommand,
  type WorkingSchedulePayload,
  workingSchedulePayloadSchema,
} from "@/lib/schedule-working-copy";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/shift-constants";
import { checkTimeConflict } from "@/lib/services/shift-assignments";
import { getCandidateScoresForTarget } from "@/lib/services/candidate-scoring";
import { evaluateAvailabilityPreferences } from "@/lib/student-availability";

const groupEditorSelect = {
  id: true,
  publishedAt: true,
  publishedVersion: true,
  event: { select: { startsAt: true, endsAt: true, sportCode: true } },
  shifts: {
    orderBy: [{ startsAt: "asc" }, { area: "asc" }, { workerType: "asc" }, { createdAt: "asc" }],
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
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          id: true,
          userId: true,
          status: true,
          callStartsAt: true,
          callEndsAt: true,
          callNote: true,
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
  workingCopy: {
    select: {
      version: true,
      basePublishedVersion: true,
      payloadVersion: true,
      payload: true,
      updatedAt: true,
      updatedById: true,
    },
  },
} satisfies Prisma.ShiftGroupSelect;

type EditorGroup = Prisma.ShiftGroupGetPayload<{ select: typeof groupEditorSelect }>;

function iso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function effectiveSlotWindow(slot: WorkingSchedulePayload["slots"][number]) {
  return {
    startsAt: slot.assignment?.callStartsAt ?? slot.callStartsAt ?? slot.startsAt,
    endsAt: slot.assignment?.callEndsAt ?? slot.callEndsAt ?? slot.endsAt,
  };
}

export function buildWorkingSchedulePayload(group: EditorGroup): WorkingSchedulePayload {
  return workingSchedulePayloadSchema.parse({
    eventStartsAt: group.event.startsAt.toISOString(),
    eventEndsAt: group.event.endsAt.toISOString(),
    slots: group.shifts.map((shift) => {
      const assignment = shift.assignments[0] ?? null;
      return {
        key: shift.id,
        sourceShiftId: shift.id,
        area: shift.area,
        workerType: shift.workerType,
        startsAt: shift.startsAt.toISOString(),
        endsAt: shift.endsAt.toISOString(),
        callStartsAt: iso(shift.callStartsAt),
        callEndsAt: iso(shift.callEndsAt),
        notes: shift.notes,
        assignmentHistoryCount: shift._count.assignments,
        assignment: assignment ? {
          sourceAssignmentId: assignment.id,
          userId: assignment.userId,
          status: assignment.status === "APPROVED" ? "APPROVED" : "DIRECT_ASSIGNED",
          callStartsAt: iso(assignment.callStartsAt),
          callEndsAt: iso(assignment.callEndsAt),
          callNote: assignment.callNote,
          activeTradeId: assignment.trades[0]?.id ?? null,
          bookingCount: assignment._count.bookings,
        } : null,
      };
    }),
  });
}

function parseStoredPayload(value: Prisma.JsonValue): WorkingSchedulePayload {
  const parsed = workingSchedulePayloadSchema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(409, "This working schedule is invalid. Discard it or contact an administrator.");
  }
  return parsed.data;
}

function editorResponse(group: EditorGroup) {
  const published = buildWorkingSchedulePayload(group);
  const working = group.workingCopy ? parseStoredPayload(group.workingCopy.payload) : published;
  const changes = summarizeWorkingScheduleChanges(published, working);
  const affectedWorkerIds = new Set<string>();
  const publishedBySourceId = new Map(
    published.slots.flatMap((slot) => slot.sourceShiftId ? [[slot.sourceShiftId, slot] as const] : []),
  );
  for (const slot of working.slots) {
    const previous = slot.sourceShiftId ? publishedBySourceId.get(slot.sourceShiftId) : null;
    const previousWindow = previous ? effectiveSlotWindow(previous) : null;
    const workingWindow = effectiveSlotWindow(slot);
    if (
      previous?.assignment?.userId !== slot.assignment?.userId
      || previous?.assignment?.callStartsAt !== slot.assignment?.callStartsAt
      || previous?.assignment?.callEndsAt !== slot.assignment?.callEndsAt
      || previous?.assignment?.callNote !== slot.assignment?.callNote
      || previousWindow?.startsAt !== workingWindow.startsAt
      || previousWindow?.endsAt !== workingWindow.endsAt
    ) {
      if (previous?.assignment?.userId) affectedWorkerIds.add(previous.assignment.userId);
      if (slot.assignment?.userId) affectedWorkerIds.add(slot.assignment.userId);
    }
  }
  for (const slot of published.slots) {
    if (slot.sourceShiftId && !working.slots.some((candidate) => candidate.sourceShiftId === slot.sourceShiftId)) {
      if (slot.assignment?.userId) affectedWorkerIds.add(slot.assignment.userId);
    }
  }
  const initialPublishWorkerCount = group.publishedAt
    ? 0
    : new Set(working.slots.flatMap((slot) => slot.assignment ? [slot.assignment.userId] : [])).size;
  return {
    shiftGroupId: group.id,
    publicationState: group.workingCopy
      ? "unpublished_changes"
      : group.publishedAt
        ? "published"
        : "draft",
    publishedAt: group.publishedAt?.toISOString() ?? null,
    publishedVersion: group.publishedVersion,
    workingVersion: group.workingCopy?.version ?? 0,
    basePublishedVersion: group.workingCopy?.basePublishedVersion ?? group.publishedVersion,
    hasWorkingCopy: Boolean(group.workingCopy),
    updatedAt: group.workingCopy?.updatedAt.toISOString() ?? null,
    updatedById: group.workingCopy?.updatedById ?? null,
    changes,
    affectedWorkerCount: group.publishedAt ? affectedWorkerIds.size : initialPublishWorkerCount,
    schedule: working,
  };
}

async function findEditorGroup(shiftGroupId: string, tx: Prisma.TransactionClient = db) {
  const group = await tx.shiftGroup.findUnique({ where: { id: shiftGroupId }, select: groupEditorSelect });
  if (!group) throw new HttpError(404, "Shift group not found");
  return group;
}

export async function getWorkingScheduleEditor(shiftGroupId: string) {
  return editorResponse(await findEditorGroup(shiftGroupId));
}

export async function getWorkingScheduleCandidateScores(shiftGroupId: string, slotKey: string) {
  const group = await findEditorGroup(shiftGroupId);
  const schedule = group.workingCopy
    ? parseStoredPayload(group.workingCopy.payload)
    : buildWorkingSchedulePayload(group);
  const slot = schedule.slots.find((candidate) => candidate.key === slotKey);
  if (!slot) throw new HttpError(404, "Working slot not found");

  return getCandidateScoresForTarget({
    id: slot.sourceShiftId ?? slot.key,
    area: slot.area,
    workerType: slot.workerType,
    startsAt: new Date(slot.startsAt),
    endsAt: new Date(slot.endsAt),
    callStartsAt: slot.callStartsAt ? new Date(slot.callStartsAt) : null,
    callEndsAt: slot.callEndsAt ? new Date(slot.callEndsAt) : null,
    sportCode: group.event.sportCode,
  });
}

export async function mutateWorkingSchedule(
  shiftGroupId: string,
  expectedVersion: number,
  command: WorkingScheduleCommand,
  actor: { id: string; role: Role },
) {
  return db.$transaction(async (tx) => {
    const group = await findEditorGroup(shiftGroupId, tx);
    const actualVersion = group.workingCopy?.version ?? 0;
    if (expectedVersion !== actualVersion) {
      throw new HttpError(409, "This schedule changed in another session. Refresh before editing again.");
    }

    const beforePayload = group.workingCopy
      ? parseStoredPayload(group.workingCopy.payload)
      : buildWorkingSchedulePayload(group);

    if (command.type === "assign") {
      const slot = beforePayload.slots.find((candidate) => candidate.key === command.slotKey);
      if (!slot) throw new HttpError(404, "Working slot not found");
      if (slot.assignment) throw new HttpError(409, "This slot is already assigned");
      const assignee = await tx.user.findUnique({
        where: { id: command.userId },
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
      if (!assignee) throw new HttpError(404, "User not found");
      if (!assignee.active) throw new HttpError(400, "Cannot assign an inactive user");
      if (assignee.staffingType !== slot.workerType) {
        throw new HttpError(409, `Choose a ${slot.workerType === "FT" ? "Staff" : "Student"} worker for this slot.`);
      }
      if (beforePayload.slots.some((candidate) => candidate.assignment?.userId === assignee.id)) {
        throw new HttpError(409, "This person is already assigned within this event draft.");
      }
      const startsAt = new Date(slot.callStartsAt ?? slot.startsAt);
      const endsAt = new Date(slot.callEndsAt ?? slot.endsAt);
      await checkTimeConflict(tx, assignee.id, startsAt, endsAt);
      if (slot.workerType === "ST") {
        const availability = evaluateAvailabilityPreferences(assignee.availabilityBlocks, { startsAt, endsAt });
        if (availability.blocking) throw new HttpError(409, availability.blocking.note);
      }
    }

    if (command.type === "unassign") {
      const slot = beforePayload.slots.find((candidate) => candidate.key === command.slotKey);
      if (!slot) throw new HttpError(404, "Working slot not found");
      if (slot.assignment?.activeTradeId) {
        throw new HttpError(409, "Cancel the active trade before unassigning this person.");
      }
      if ((slot.assignment?.bookingCount ?? 0) > 0) {
        throw new HttpError(409, "Unlink the assignment's booking before unassigning this person.");
      }
    }
    if (command.type === "setCallWindow") {
      const slot = beforePayload.slots.find((candidate) => candidate.key === command.slotKey);
      if (!slot) throw new HttpError(404, "Working slot not found");
      if (Boolean(command.callStartsAt) !== Boolean(command.callEndsAt)) {
        throw new HttpError(400, "Call start and release time must both be set or both be cleared.");
      }
      if (
        command.callStartsAt
        && command.callEndsAt
        && new Date(command.callEndsAt) <= new Date(command.callStartsAt)
      ) {
        throw new HttpError(400, "Release time must be after call time.");
      }
      if (slot.assignment) {
        const assignee = await tx.user.findUnique({
          where: { id: slot.assignment.userId },
          select: {
            id: true,
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
        if (!assignee) throw new HttpError(404, "Assigned user not found");
        const startsAt = new Date(command.callStartsAt ?? slot.startsAt);
        const endsAt = new Date(command.callEndsAt ?? slot.endsAt);
        await checkTimeConflict(tx, assignee.id, startsAt, endsAt, slot.assignment.sourceAssignmentId ?? undefined);
        if (slot.workerType === "ST") {
          const availability = evaluateAvailabilityPreferences(assignee.availabilityBlocks, { startsAt, endsAt });
          if (availability.blocking) throw new HttpError(409, availability.blocking.note);
        }
      }
    }
    let afterPayload: WorkingSchedulePayload;
    try {
      afterPayload = applyWorkingScheduleCommand(
        beforePayload,
        command,
        () => `draft:${randomUUID()}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "UNASSIGN_BEFORE_REDUCING") {
        throw new HttpError(409, "Unassign an open matching slot before reducing this crew count.");
      }
      if (error instanceof Error && error.message === "UNASSIGN_BEFORE_CONVERTING") {
        throw new HttpError(409, "Unassign this person before converting the slot.");
      }
      if (error instanceof Error && error.message === "WORKING_SLOT_NOT_FOUND") {
        throw new HttpError(404, "Working slot not found");
      }
      if (error instanceof Error && error.message === "WORKING_SLOT_ALREADY_ASSIGNED") {
        throw new HttpError(409, "This slot is already assigned");
      }
      if (error instanceof Error && error.message === "WORKING_SLOT_NOT_ASSIGNED") {
        throw new HttpError(409, "This slot is not assigned");
      }
      throw error;
    }

    const nextVersion = actualVersion + 1;
    if (group.workingCopy) {
      const updated = await tx.shiftGroupWorkingCopy.updateMany({
        where: { shiftGroupId, version: expectedVersion },
        data: {
          version: nextVersion,
          payload: afterPayload as unknown as Prisma.InputJsonValue,
          updatedById: actor.id,
        },
      });
      if (updated.count !== 1) {
        throw new HttpError(409, "This schedule changed in another session. Refresh before editing again.");
      }
    } else {
      try {
        await tx.shiftGroupWorkingCopy.create({
          data: {
            shiftGroupId,
            version: nextVersion,
            basePublishedVersion: group.publishedVersion,
            payloadVersion: 1,
            payload: afterPayload as unknown as Prisma.InputJsonValue,
            createdById: actor.id,
            updatedById: actor.id,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new HttpError(409, "This schedule changed in another session. Refresh before editing again.");
        }
        throw error;
      }
    }

    await createAuditEntryTx(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_group_working_copy",
      entityId: shiftGroupId,
      action: `working_schedule_${command.type}`,
      before: { version: actualVersion, command, changes: summarizeWorkingScheduleChanges(buildWorkingSchedulePayload(group), beforePayload) },
      after: { version: nextVersion, changes: summarizeWorkingScheduleChanges(buildWorkingSchedulePayload(group), afterPayload) },
    });

    return editorResponse(await findEditorGroup(shiftGroupId, tx));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function discardWorkingSchedule(
  shiftGroupId: string,
  expectedVersion: number,
  actor: { id: string; role: Role },
) {
  return db.$transaction(async (tx) => {
    const group = await findEditorGroup(shiftGroupId, tx);
    if (!group.workingCopy) return editorResponse(group);
    if (group.workingCopy.version !== expectedVersion) {
      throw new HttpError(409, "This schedule changed in another session. Refresh before discarding it.");
    }

    const deleted = await tx.shiftGroupWorkingCopy.deleteMany({
      where: { shiftGroupId, version: expectedVersion },
    });
    if (deleted.count !== 1) {
      throw new HttpError(409, "This schedule changed in another session. Refresh before discarding it.");
    }
    await createAuditEntryTx(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_group_working_copy",
      entityId: shiftGroupId,
      action: "working_schedule_discarded",
      before: {
        version: expectedVersion,
        changes: summarizeWorkingScheduleChanges(buildWorkingSchedulePayload(group), parseStoredPayload(group.workingCopy.payload)),
      },
      after: { version: 0 },
    });

    return editorResponse(await findEditorGroup(shiftGroupId, tx));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
