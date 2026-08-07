import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, createAuditEntriesTx, updateShiftAssignmentConflictsTx, buildSnapshot } = vi.hoisted(() => ({
  tx: {
    sportConfig: { findMany: vi.fn() },
    calendarEvent: { findMany: vi.fn() },
    shift: { update: vi.fn() },
    shiftAssignment: { updateMany: vi.fn() },
    shiftGroup: { update: vi.fn() },
    shiftGroupWorkingCopy: { updateMany: vi.fn() },
    auditLog: { createMany: vi.fn() },
  },
  createAuditEntriesTx: vi.fn(),
  updateShiftAssignmentConflictsTx: vi.fn(),
  buildSnapshot: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  },
}));

vi.mock("@/lib/audit", () => ({ createAuditEntriesTx }));
vi.mock("@/lib/services/shift-assignment-conflicts", () => ({ updateShiftAssignmentConflictsTx }));
vi.mock("@/lib/services/schedule-publication", () => ({
  buildSchedulePublicationSnapshot: buildSnapshot,
}));

import { Role } from "@prisma/client";
import { syncCurrentSportCallTimes } from "@/lib/services/schedule-call-time-sync";

const eventStartsAt = new Date("2026-08-20T18:00:00Z");
const eventEndsAt = new Date("2026-08-20T21:00:00Z");
const defaultStartsAt = new Date("2026-08-20T17:00:00Z");
const defaultEndsAt = new Date("2026-08-20T22:00:00Z");

function workingSlot(overrides: Record<string, unknown> = {}) {
  return {
    key: "shift-1",
    sourceShiftId: "shift-1",
    area: "VIDEO",
    workerType: "ST",
    startsAt: eventStartsAt.toISOString(),
    endsAt: eventEndsAt.toISOString(),
    callStartsAt: null,
    callEndsAt: null,
    notes: null,
    assignmentHistoryCount: 1,
    assignment: {
      sourceAssignmentId: "assignment-1",
      userId: "student-1",
      status: "DIRECT_ASSIGNED",
      callStartsAt: null,
      callEndsAt: null,
      callNote: null,
      activeTradeId: null,
      bookingCount: 0,
    },
    ...overrides,
  };
}

function assignedUser() {
  return {
    role: "STUDENT",
    staffingType: "ST",
    availabilityBlocks: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.sportConfig.findMany.mockResolvedValue([{
    sportCode: "FB",
    shiftStartOffset: 60,
    shiftEndOffset: 60,
  }]);
  tx.shift.update.mockResolvedValue({});
  tx.shiftAssignment.updateMany.mockResolvedValue({ count: 0 });
  tx.shiftGroup.update.mockResolvedValue({});
  tx.shiftGroupWorkingCopy.updateMany.mockResolvedValue({ count: 1 });
  createAuditEntriesTx.mockResolvedValue(undefined);
  updateShiftAssignmentConflictsTx.mockResolvedValue(undefined);
  buildSnapshot.mockReturnValue({ shifts: [] });
});

describe("syncCurrentSportCallTimes", () => {
  it("updates fallback windows everywhere while preserving slot and personal overrides", async () => {
    tx.calendarEvent.findMany.mockResolvedValue([{
      id: "event-1",
      sportCode: "FB",
      allDay: false,
      startsAt: eventStartsAt,
      endsAt: eventEndsAt,
      shiftGroup: {
        id: "group-1",
        publishedAt: null,
        publishedVersion: 0,
        shifts: [
          {
            id: "shift-1",
            area: "VIDEO",
            workerType: "ST",
            startsAt: eventStartsAt,
            endsAt: eventEndsAt,
            callStartsAt: null,
            callEndsAt: null,
            assignments: [{
              id: "assignment-1",
              userId: "student-1",
              status: "DIRECT_ASSIGNED",
              callStartsAt: null,
              callEndsAt: null,
              callNote: null,
              user: assignedUser(),
            }],
          },
          {
            id: "shift-2",
            area: "PHOTO",
            workerType: "ST",
            startsAt: eventStartsAt,
            endsAt: eventEndsAt,
            callStartsAt: new Date("2026-08-20T18:30:00Z"),
            callEndsAt: new Date("2026-08-20T20:30:00Z"),
            assignments: [{
              id: "assignment-2",
              userId: "student-2",
              status: "DIRECT_ASSIGNED",
              callStartsAt: null,
              callEndsAt: null,
              callNote: null,
              user: assignedUser(),
            }],
          },
        ],
        workingCopy: {
          version: 4,
          payload: {
            eventStartsAt: eventStartsAt.toISOString(),
            eventEndsAt: eventEndsAt.toISOString(),
            slots: [
              workingSlot(),
              workingSlot({
                key: "shift-2",
                sourceShiftId: "shift-2",
                area: "PHOTO",
                callStartsAt: "2026-08-20T18:30:00.000Z",
                callEndsAt: "2026-08-20T20:30:00.000Z",
                assignment: null,
              }),
            ],
          },
        },
      },
    }]);

    const result = await syncCurrentSportCallTimes(["FB"], {
      now: new Date("2026-08-01T00:00:00Z"),
      actor: { id: "admin-1", role: Role.ADMIN },
    });

    expect(result).toMatchObject({
      eventsMatched: 1,
      groupsInspected: 1,
      groupsUpdated: 1,
      shiftsUpdated: 2,
      workingCopiesUpdated: 1,
      publishedGroupsUpdated: 0,
      assignmentsAcknowledgementReset: 0,
      allDayEventsSkipped: 0,
      changedGroupIds: ["group-1"],
    });
    expect(tx.shift.update).toHaveBeenCalledTimes(2);
    expect(tx.shift.update).toHaveBeenCalledWith({
      where: { id: "shift-1" },
      data: { startsAt: defaultStartsAt, endsAt: defaultEndsAt },
    });
    expect(tx.shift.update).toHaveBeenCalledWith({
      where: { id: "shift-2" },
      data: { startsAt: defaultStartsAt, endsAt: defaultEndsAt },
    });
    expect(tx.shiftGroupWorkingCopy.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { shiftGroupId: "group-1", version: 4 },
      data: expect.objectContaining({
        version: { increment: 1 },
        updatedById: "admin-1",
        payload: expect.objectContaining({
          slots: expect.arrayContaining([
            expect.objectContaining({
              startsAt: defaultStartsAt.toISOString(),
              endsAt: defaultEndsAt.toISOString(),
            }),
            expect.objectContaining({
              callStartsAt: "2026-08-20T18:30:00.000Z",
              callEndsAt: "2026-08-20T20:30:00.000Z",
              startsAt: defaultStartsAt.toISOString(),
              endsAt: defaultEndsAt.toISOString(),
            }),
          ]),
        }),
      }),
    }));
    expect(updateShiftAssignmentConflictsTx).toHaveBeenCalledWith(
      tx,
      expect.arrayContaining([
        expect.objectContaining({ id: "assignment-1" }),
        expect.objectContaining({ id: "assignment-2" }),
      ]),
      false,
    );
    expect(createAuditEntriesTx).toHaveBeenCalledWith(tx, [expect.objectContaining({
      before: expect.objectContaining({
        changedShiftWindows: expect.arrayContaining([
          expect.objectContaining({
            shiftId: "shift-1",
            startsAt: eventStartsAt.toISOString(),
            endsAt: eventEndsAt.toISOString(),
          }),
        ]),
      }),
    })]);
  });

  it("skips all-day events so settings never invent clock times", async () => {
    tx.calendarEvent.findMany.mockResolvedValue([{
      id: "event-all-day",
      sportCode: "FB",
      allDay: true,
      startsAt: new Date("2026-08-21T00:00:00Z"),
      endsAt: new Date("2026-08-22T00:00:00Z"),
      shiftGroup: {
        id: "group-all-day",
        publishedAt: null,
        publishedVersion: 0,
        shifts: [],
        workingCopy: null,
      },
    }]);

    await expect(syncCurrentSportCallTimes(["FB"])).resolves.toMatchObject({
      eventsMatched: 1,
      allDayEventsSkipped: 1,
      groupsInspected: 0,
      groupsUpdated: 0,
    });
    expect(tx.shift.update).not.toHaveBeenCalled();
    expect(tx.shiftGroupWorkingCopy.updateMany).not.toHaveBeenCalled();
  });

  it("supports a read-only dry run through the same synchronization path", async () => {
    tx.calendarEvent.findMany.mockResolvedValue([{
      id: "event-dry-run",
      sportCode: "FB",
      allDay: false,
      startsAt: eventStartsAt,
      endsAt: eventEndsAt,
      shiftGroup: {
        id: "group-dry-run",
        publishedAt: null,
        publishedVersion: 0,
        shifts: [{
          id: "shift-dry-run",
          area: "VIDEO",
          workerType: "ST",
          startsAt: eventStartsAt,
          endsAt: eventEndsAt,
          callStartsAt: null,
          callEndsAt: null,
          assignments: [],
        }],
        workingCopy: null,
      },
    }]);

    await expect(syncCurrentSportCallTimes(["FB"], { dryRun: true })).resolves.toMatchObject({
      groupsUpdated: 1,
      shiftsUpdated: 1,
    });
    expect(tx.shift.update).not.toHaveBeenCalled();
    expect(tx.shiftGroupWorkingCopy.updateMany).not.toHaveBeenCalled();
    expect(createAuditEntriesTx).not.toHaveBeenCalled();
  });

  it("does not create a phantom published version for a draft-only payload repair", async () => {
    tx.calendarEvent.findMany.mockResolvedValue([{
      id: "event-draft-only",
      sportCode: "FB",
      allDay: false,
      startsAt: eventStartsAt,
      endsAt: eventEndsAt,
      shiftGroup: {
        id: "group-draft-only",
        publishedAt: new Date("2026-07-01T00:00:00Z"),
        publishedVersion: 5,
        shifts: [{
          id: "shift-already-current",
          area: "VIDEO",
          workerType: "ST",
          startsAt: defaultStartsAt,
          endsAt: defaultEndsAt,
          callStartsAt: null,
          callEndsAt: null,
          assignments: [],
        }],
        workingCopy: {
          version: 2,
          payload: {
            eventStartsAt: eventStartsAt.toISOString(),
            eventEndsAt: eventEndsAt.toISOString(),
            slots: [workingSlot()],
          },
        },
      },
    }]);

    const result = await syncCurrentSportCallTimes(["FB"]);

    expect(result).toMatchObject({
      shiftsUpdated: 0,
      workingCopiesUpdated: 1,
      publishedGroupsUpdated: 0,
      publishedChanges: [],
    });
    expect(tx.shiftGroup.update).not.toHaveBeenCalled();
    expect(tx.shiftGroupWorkingCopy.updateMany).toHaveBeenCalledOnce();
  });

  it("updates published snapshots and resets acknowledgements only for changed effective windows", async () => {
    tx.calendarEvent.findMany.mockResolvedValue([{
      id: "event-published",
      sportCode: "FB",
      allDay: false,
      startsAt: eventStartsAt,
      endsAt: eventEndsAt,
      shiftGroup: {
        id: "group-published",
        publishedAt: new Date("2026-07-01T00:00:00Z"),
        publishedVersion: 2,
        shifts: [{
          id: "shift-published",
          area: "VIDEO",
          workerType: "ST",
          startsAt: eventStartsAt,
          endsAt: eventEndsAt,
          callStartsAt: null,
          callEndsAt: null,
          assignments: [{
            id: "assignment-published",
            userId: "student-1",
            status: "APPROVED",
            callStartsAt: null,
            callEndsAt: null,
            callNote: null,
            user: assignedUser(),
          }],
        }],
        workingCopy: null,
      },
    }]);

    const result = await syncCurrentSportCallTimes(["FB"]);

    expect(result).toMatchObject({
      publishedGroupsUpdated: 1,
      assignmentsAcknowledgementReset: 1,
      publishedChanges: [{ shiftGroupId: "group-published", affectedUserIds: ["student-1"] }],
    });
    expect(tx.shiftAssignment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["assignment-published"] } },
      data: { acknowledgedAt: null, acknowledgedById: null },
    });
    expect(tx.shiftGroup.update).toHaveBeenCalledWith({
      where: { id: "group-published" },
      data: {
        publishedVersion: { increment: 1 },
        lastPublishedSnapshot: { shifts: [] },
      },
    });
    expect(buildSnapshot).toHaveBeenCalledOnce();
  });

  it("supports an explicit one-time override that clears shift and personal call windows", async () => {
    tx.calendarEvent.findMany.mockResolvedValue([{
      id: "event-override",
      sportCode: "FB",
      allDay: false,
      startsAt: eventStartsAt,
      endsAt: eventEndsAt,
      shiftGroup: {
        id: "group-override",
        publishedAt: null,
        publishedVersion: 0,
        shifts: [{
          id: "shift-override",
          area: "VIDEO",
          workerType: "ST",
          startsAt: eventStartsAt,
          endsAt: eventEndsAt,
          callStartsAt: new Date("2026-08-20T16:00:00Z"),
          callEndsAt: new Date("2026-08-20T21:00:00Z"),
          assignments: [{
            id: "assignment-override",
            userId: "student-1",
            status: "DIRECT_ASSIGNED",
            callStartsAt: new Date("2026-08-20T16:30:00Z"),
            callEndsAt: new Date("2026-08-20T20:30:00Z"),
            callNote: "Keep the note",
            user: assignedUser(),
          }],
        }],
        workingCopy: {
          version: 3,
          payload: {
            eventStartsAt: eventStartsAt.toISOString(),
            eventEndsAt: eventEndsAt.toISOString(),
            slots: [workingSlot({
              callStartsAt: "2026-08-20T16:00:00.000Z",
              callEndsAt: "2026-08-20T21:00:00.000Z",
              assignment: {
                ...workingSlot().assignment,
                callStartsAt: "2026-08-20T16:30:00.000Z",
                callEndsAt: "2026-08-20T20:30:00.000Z",
              },
            })],
          },
        },
      },
    }]);

    const result = await syncCurrentSportCallTimes(["FB"], {
      now: new Date("2026-08-01T00:00:00Z"),
      dryRun: true,
      overrideExistingCallTimes: true,
      actor: { id: "admin-1", role: Role.ADMIN },
    });

    expect(result).toMatchObject({
      groupsUpdated: 1,
      shiftsUpdated: 1,
      shiftCallOverridesCleared: 1,
      assignmentCallOverridesCleared: 1,
      workingCopiesUpdated: 1,
    });
    expect(tx.shift.update).not.toHaveBeenCalled();
    expect(tx.shiftAssignment.updateMany).not.toHaveBeenCalled();
    expect(tx.shiftGroupWorkingCopy.updateMany).not.toHaveBeenCalled();
    expect(createAuditEntriesTx).not.toHaveBeenCalled();
  });
});
