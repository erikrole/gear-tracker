import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

const transactionCalls: Array<{ options: unknown }> = [];

vi.mock("@/lib/db", () => {
  const mockTx = {
    shift: { findUnique: vi.fn() },
    shiftAssignment: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
  };

  return {
    db: {
      user: { findUnique: vi.fn() },
      shift: { findMany: vi.fn() },
      shiftAssignment: { findMany: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
        transactionCalls.push({ options });
        return fn(mockTx);
      }),
      _mockTx: mockTx,
    },
  };
});

import { db } from "@/lib/db";
import { getScheduleOpenWork, pickupOpenShift } from "@/lib/services/schedule-open-work";

const mockDb = db as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  shift: { findMany: ReturnType<typeof vi.fn> };
  shiftAssignment: { findMany: ReturnType<typeof vi.fn> };
  _mockTx: {
    shift: { findUnique: ReturnType<typeof vi.fn> };
    shiftAssignment: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    user: { findUnique: ReturnType<typeof vi.fn> };
  };
};

const now = new Date("2026-09-01T12:00:00Z");

function baseEvent() {
  return {
    id: "event-1",
    summary: "Wisconsin vs Iowa",
    startsAt: new Date("2026-09-05T18:00:00Z"),
    endsAt: new Date("2026-09-05T21:00:00Z"),
    sportCode: "football",
    opponent: "Iowa",
    isHome: true,
    isHidden: false,
    archivedAt: null,
    status: "CONFIRMED",
  };
}

function baseShift(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift-1",
    area: "VIDEO",
    workerType: "ST",
    startsAt: new Date("2026-09-05T16:00:00Z"),
    endsAt: new Date("2026-09-05T21:00:00Z"),
    callStartsAt: null,
    callEndsAt: null,
    shiftGroupId: "group-1",
    assignments: [],
    shiftGroup: {
      id: "group-1",
      isPremier: false,
      publishedAt: new Date("2026-09-01T10:00:00Z"),
      archivedAt: null,
      event: baseEvent(),
    },
    ...overrides,
  };
}

function activeStudent() {
  return {
    id: "student-1",
    role: "STUDENT",
    active: true,
    primaryArea: "VIDEO",
    areaAssignments: [{ area: "VIDEO", isPrimary: true }],
    sportAssignments: [{ sportCode: "football" }],
    availabilityBlocks: [],
  };
}

beforeEach(() => {
  transactionCalls.length = 0;
  mockDb.user.findUnique.mockReset();
  mockDb.shift.findMany.mockReset();
  mockDb.shiftAssignment.findMany.mockReset();
  mockDb._mockTx.shift.findUnique.mockReset();
  mockDb._mockTx.user.findUnique.mockReset();
  mockDb._mockTx.shiftAssignment.findFirst.mockReset();
  mockDb._mockTx.shiftAssignment.create.mockReset();
});

describe("schedule open work", () => {
  it("returns published open Student shifts with candidate eligibility", async () => {
    mockDb.user.findUnique.mockResolvedValue(activeStudent());
    mockDb.shiftAssignment.findMany.mockResolvedValue([]);
    mockDb.shift.findMany.mockResolvedValue([baseShift()]);

    const result = await getScheduleOpenWork({
      userId: "student-1",
      role: "STUDENT",
      now,
    });

    expect(mockDb.shift.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workerType: "ST",
        assignments: { none: { status: { in: ["DIRECT_ASSIGNED", "APPROVED"] } } },
        shiftGroup: expect.objectContaining({
          publishedAt: { not: null },
          archivedAt: null,
        }),
      }),
    }));
    expect(result.openShifts[0]).toEqual(expect.objectContaining({
      id: "shift-1",
      action: "claim",
      canAct: true,
      requestCount: 0,
    }));
  });

  it("claims a non-premier open shift as an acknowledged direct assignment", async () => {
    mockDb._mockTx.shift.findUnique.mockResolvedValue(baseShift());
    mockDb._mockTx.user.findUnique.mockResolvedValue(activeStudent());
    mockDb._mockTx.shiftAssignment.findFirst.mockResolvedValue(null);
    mockDb._mockTx.shiftAssignment.create.mockResolvedValue({ id: "assignment-1", status: "DIRECT_ASSIGNED" });

    await pickupOpenShift("shift-1", "student-1");

    expect(mockDb._mockTx.shiftAssignment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        shiftId: "shift-1",
        userId: "student-1",
        status: "DIRECT_ASSIGNED",
        assignedBy: "student-1",
        acknowledgedById: "student-1",
      }),
    }));
    expectSerializableIsolation(transactionCalls, 0);
  });

  it("creates a request instead of direct assignment for premier shifts", async () => {
    mockDb._mockTx.shift.findUnique.mockResolvedValue(baseShift({
      shiftGroup: {
        id: "group-1",
        isPremier: true,
        publishedAt: new Date("2026-09-01T10:00:00Z"),
        archivedAt: null,
        event: baseEvent(),
      },
    }));
    mockDb._mockTx.user.findUnique.mockResolvedValue(activeStudent());
    mockDb._mockTx.shiftAssignment.findFirst.mockResolvedValue(null);
    mockDb._mockTx.shiftAssignment.create.mockResolvedValue({ id: "assignment-1", status: "REQUESTED" });

    await pickupOpenShift("shift-1", "student-1");

    expect(mockDb._mockTx.shiftAssignment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "REQUESTED",
        assignedBy: null,
      }),
    }));
  });

  it("rejects draft shifts before worker pickup", async () => {
    mockDb._mockTx.shift.findUnique.mockResolvedValue(baseShift({
      shiftGroup: {
        id: "group-1",
        isPremier: false,
        publishedAt: null,
        archivedAt: null,
        event: baseEvent(),
      },
    }));
    mockDb._mockTx.user.findUnique.mockResolvedValue(activeStudent());

    await expect(pickupOpenShift("shift-1", "student-1")).rejects.toThrow("Draft shifts are not open for pickup");
  });

  it("rejects already filled shifts", async () => {
    mockDb._mockTx.shift.findUnique.mockResolvedValue(baseShift({
      assignments: [{ id: "assignment-1", userId: "other", status: "APPROVED" }],
    }));
    mockDb._mockTx.user.findUnique.mockResolvedValue(activeStudent());

    await expect(pickupOpenShift("shift-1", "student-1")).rejects.toThrow("already has an active assignment");
  });
});
