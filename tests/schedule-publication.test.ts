import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

const transactionCalls: Array<{ options: unknown }> = [];

vi.mock("@/lib/db", () => {
  const mockTx = {
    shiftGroup: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    shiftAssignment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    shift: {
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    shiftGroupWorkingCopy: {
      deleteMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  };

  return {
    db: {
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      _mockTx: mockTx,
    },
  };
});

import { db } from "@/lib/db";
import {
  acknowledgeShiftAssignment,
  buildSchedulePublicationSnapshot,
  getSchedulePublicationState,
  publishShiftGroup,
} from "@/lib/services/schedule-publication";

const mockTx = (db as typeof db & {
  _mockTx: {
    shiftGroup: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    shiftAssignment: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    shift: {
      update: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    shiftGroupWorkingCopy: {
      deleteMany: ReturnType<typeof vi.fn>;
    };
    user: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };
})._mockTx;

function shift(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift-1",
    area: "VIDEO",
    workerType: "ST",
    startsAt: new Date("2026-10-06T18:00:00.000Z"),
    endsAt: new Date("2026-10-06T21:00:00.000Z"),
    callStartsAt: null,
    callEndsAt: null,
    assignments: [
      {
        id: "assignment-1",
        userId: "user-1",
        status: "DIRECT_ASSIGNED",
        callStartsAt: null,
        callEndsAt: null,
        callNote: null,
        acknowledgedAt: null,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  transactionCalls.length = 0;
  vi.clearAllMocks();
  mockTx.shiftAssignment.findMany.mockResolvedValue([]);
});

describe("schedule publication state", () => {
  it("treats acknowledgement changes as unacknowledged state, not schedule changes", () => {
    const snapshot = buildSchedulePublicationSnapshot({ shifts: [shift()] });

    const state = getSchedulePublicationState({
      publishedAt: new Date("2026-10-01T12:00:00.000Z"),
      publishedById: "staff-1",
      lastPublishedSnapshot: snapshot,
      shifts: [
        shift({
          assignments: [
            {
              id: "assignment-1",
              userId: "user-1",
              status: "DIRECT_ASSIGNED",
              callStartsAt: null,
              callEndsAt: null,
              callNote: null,
              acknowledgedAt: new Date("2026-10-01T12:01:00.000Z"),
            },
          ],
        }),
      ],
    });

    expect(state).toEqual({
      status: "published",
      publishedAt: "2026-10-01T12:00:00.000Z",
      publishedById: "staff-1",
      changedAfterPublish: false,
      activeAssignmentCount: 1,
      acknowledgedCount: 1,
      unacknowledgedCount: 0,
    });
  });

  it("marks a group changed when the worker-facing assignment snapshot differs", () => {
    const snapshot = buildSchedulePublicationSnapshot({ shifts: [shift()] });

    const state = getSchedulePublicationState({
      publishedAt: new Date("2026-10-01T12:00:00.000Z"),
      publishedById: "staff-1",
      lastPublishedSnapshot: snapshot,
      shifts: [
        shift({
          assignments: [
            {
              id: "assignment-1",
              userId: "user-2",
              status: "DIRECT_ASSIGNED",
              callStartsAt: null,
              callEndsAt: null,
              callNote: null,
              acknowledgedAt: null,
            },
          ],
        }),
      ],
    });

    expect(state.status).toBe("changed");
    expect(state.changedAfterPublish).toBe(true);
  });
});

describe("publishShiftGroup", () => {
  it("stores the current snapshot in a serializable transaction", async () => {
    const group = {
      id: "group-1",
      publishedAt: null,
      publishedById: null,
      lastPublishedSnapshot: null,
      shifts: [shift()],
    };
    mockTx.shiftGroup.findUnique.mockResolvedValue(group);
    mockTx.shiftGroup.update.mockImplementation(async ({ data }) => ({
      ...group,
      publishedAt: data.publishedAt,
      publishedById: data.publishedById,
      lastPublishedSnapshot: data.lastPublishedSnapshot,
    }));

    const result = await publishShiftGroup("group-1", "staff-1");

    expectSerializableIsolation(transactionCalls, 0);
    expect(mockTx.shiftGroup.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "group-1" },
      data: expect.objectContaining({
        publishedById: "staff-1",
        lastPublishedSnapshot: expect.objectContaining({ shifts: expect.any(Array) }),
      }),
    }));
    expect(result.before.status).toBe("draft");
    expect(result.after.status).toBe("published");
  });

  it("reconciles an empty working slot and removes the draft in the publish transaction", async () => {
    const currentShift = {
      ...shift(),
      notes: null,
      assignments: [],
      _count: { assignments: 0 },
    };
    const group = {
      id: "group-1",
      publishedAt: new Date("2026-10-01T12:00:00.000Z"),
      publishedById: "staff-1",
      publishedVersion: 1,
      lastPublishedSnapshot: buildSchedulePublicationSnapshot({ shifts: [currentShift] }),
      workingCopy: {
        version: 2,
        basePublishedVersion: 1,
        payload: {
          eventStartsAt: "2026-10-06T18:00:00.000Z",
          eventEndsAt: "2026-10-06T21:00:00.000Z",
          slots: [
            {
              key: "shift-1",
              sourceShiftId: "shift-1",
              area: "VIDEO",
              workerType: "ST",
              startsAt: "2026-10-06T18:00:00.000Z",
              endsAt: "2026-10-06T21:00:00.000Z",
              callStartsAt: null,
              callEndsAt: null,
              notes: null,
              assignmentHistoryCount: 0,
              assignment: null,
            },
            {
              key: "draft:new",
              sourceShiftId: null,
              area: "PHOTO",
              workerType: "FT",
              startsAt: "2026-10-06T18:00:00.000Z",
              endsAt: "2026-10-06T21:00:00.000Z",
              callStartsAt: null,
              callEndsAt: null,
              notes: null,
              assignmentHistoryCount: 0,
              assignment: null,
            },
          ],
        },
      },
      shifts: [currentShift],
    };
    mockTx.shiftGroup.findUnique.mockResolvedValue(group);
    mockTx.shift.update.mockResolvedValue({ id: "shift-1" });
    mockTx.shift.create.mockResolvedValue({ id: "shift-new" });
    mockTx.shiftGroupWorkingCopy.deleteMany.mockResolvedValue({ count: 1 });
    mockTx.shiftGroup.update.mockImplementation(async ({ data }) => ({
      ...group,
      publishedAt: data.publishedAt ?? group.publishedAt,
      publishedById: data.publishedById ?? group.publishedById,
      lastPublishedSnapshot: data.lastPublishedSnapshot ?? group.lastPublishedSnapshot,
    }));

    const result = await publishShiftGroup("group-1", "staff-1", 2);

    expectSerializableIsolation(transactionCalls, 0);
    expect(mockTx.shift.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ area: "PHOTO", workerType: "FT" }),
    }));
    expect(mockTx.shiftGroupWorkingCopy.deleteMany).toHaveBeenCalledWith({
      where: { shiftGroupId: "group-1", version: 2 },
    });
    expect(result.workingVersion).toBe(2);
  });

  it("revalidates an assigned call-window change and resets acknowledgement on publish", async () => {
    const currentAssignment = {
      id: "assignment-1",
      userId: "user-1",
      status: "DIRECT_ASSIGNED",
      callStartsAt: null,
      callEndsAt: null,
      callNote: null,
      acknowledgedAt: new Date("2026-10-01T12:05:00.000Z"),
      trades: [],
      _count: { bookings: 0 },
    };
    const currentShift = {
      ...shift({ assignments: [currentAssignment] }),
      notes: null,
      _count: { assignments: 1 },
    };
    const workingSlot = {
      key: "shift-1",
      sourceShiftId: "shift-1",
      area: "VIDEO",
      workerType: "ST",
      startsAt: "2026-10-06T18:00:00.000Z",
      endsAt: "2026-10-06T21:00:00.000Z",
      callStartsAt: "2026-10-06T17:00:00.000Z",
      callEndsAt: "2026-10-06T22:00:00.000Z",
      notes: null,
      assignmentHistoryCount: 1,
      assignment: {
        sourceAssignmentId: "assignment-1",
        userId: "user-1",
        status: "DIRECT_ASSIGNED",
        callStartsAt: null,
        callEndsAt: null,
        callNote: null,
        activeTradeId: null,
        bookingCount: 0,
      },
    };
    const group = {
      id: "group-1",
      publishedAt: new Date("2026-10-01T12:00:00.000Z"),
      publishedById: "staff-1",
      publishedVersion: 1,
      lastPublishedSnapshot: buildSchedulePublicationSnapshot({ shifts: [currentShift] }),
      workingCopy: {
        version: 2,
        basePublishedVersion: 1,
        payload: {
          eventStartsAt: "2026-10-06T18:00:00.000Z",
          eventEndsAt: "2026-10-06T21:00:00.000Z",
          slots: [workingSlot],
        },
      },
      shifts: [currentShift],
    };
    const updatedShift = {
      ...currentShift,
      callStartsAt: new Date(workingSlot.callStartsAt),
      callEndsAt: new Date(workingSlot.callEndsAt),
      assignments: [{ ...currentAssignment, acknowledgedAt: null }],
    };
    mockTx.shiftGroup.findUnique
      .mockResolvedValueOnce(group)
      .mockResolvedValueOnce({ ...group, shifts: [updatedShift] });
    mockTx.user.findMany.mockResolvedValue([{
      id: "user-1",
      active: true,
      staffingType: "ST",
      availabilityBlocks: [],
    }]);
    mockTx.shift.update.mockResolvedValue({ id: "shift-1" });
    mockTx.shiftAssignment.update.mockResolvedValue({ id: "assignment-1" });
    mockTx.shiftGroupWorkingCopy.deleteMany.mockResolvedValue({ count: 1 });
    mockTx.shiftGroup.update.mockImplementation(async ({ data }) => ({
      ...group,
      shifts: [updatedShift],
      publishedAt: data.publishedAt ?? group.publishedAt,
      publishedById: data.publishedById ?? group.publishedById,
      lastPublishedSnapshot: data.lastPublishedSnapshot ?? group.lastPublishedSnapshot,
    }));

    const result = await publishShiftGroup("group-1", "staff-1", 2);

    expect(mockTx.shift.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "shift-1" },
      data: expect.objectContaining({
        callStartsAt: new Date("2026-10-06T17:00:00.000Z"),
        callEndsAt: new Date("2026-10-06T22:00:00.000Z"),
      }),
    }));
    expect(mockTx.shiftAssignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { acknowledgedAt: null, acknowledgedById: null },
    });
    expect(result.affectedUserIds).toEqual(["user-1"]);
  });
});

describe("acknowledgeShiftAssignment", () => {
  it("allows only the assigned worker to acknowledge a published active assignment", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue({
      id: "assignment-1",
      userId: "user-1",
      status: "DIRECT_ASSIGNED",
      acknowledgedAt: null,
      shift: { shiftGroup: { id: "group-1", publishedAt: new Date("2026-10-01T12:00:00.000Z") } },
    });
    mockTx.shiftAssignment.update.mockResolvedValue({
      id: "assignment-1",
      shiftId: "shift-1",
      userId: "user-1",
      status: "DIRECT_ASSIGNED",
      acknowledgedAt: new Date("2026-10-01T12:05:00.000Z"),
      acknowledgedById: "user-1",
    });

    const result = await acknowledgeShiftAssignment("assignment-1", { id: "user-1", role: "STUDENT" });

    expectSerializableIsolation(transactionCalls, 0);
    expect(result.after.acknowledgedById).toBe("user-1");
  });

  it("rejects acknowledgement by a different user", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue({
      id: "assignment-1",
      userId: "user-1",
      status: "DIRECT_ASSIGNED",
      acknowledgedAt: null,
      shift: { shiftGroup: { id: "group-1", publishedAt: new Date("2026-10-01T12:00:00.000Z") } },
    });

    await expect(acknowledgeShiftAssignment("assignment-1", { id: "user-2", role: "STUDENT" }))
      .rejects
      .toMatchObject({ status: 403 });
  });
});
