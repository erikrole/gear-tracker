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
      update: vi.fn(),
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
      update: ReturnType<typeof vi.fn>;
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
