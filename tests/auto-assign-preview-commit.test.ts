import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

const transactionCalls: Array<{ options: unknown }> = [];

vi.mock("@/lib/services/auto-fill-preview", () => ({
  getAutoFillPreview: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntriesTx: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const mockTx = {
    shiftAssignment: {
      findMany: vi.fn(),
      createManyAndReturn: vi.fn(),
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
import { createAuditEntriesTx } from "@/lib/audit";
import { getAutoFillPreview } from "@/lib/services/auto-fill-preview";
import { autoAssignShiftGroup } from "@/lib/services/auto-assign";

const mockTx = (db as typeof db & {
  _mockTx: {
    shiftAssignment: {
      findMany: ReturnType<typeof vi.fn>;
      createManyAndReturn: ReturnType<typeof vi.fn>;
    };
  };
})._mockTx;

beforeEach(() => {
  transactionCalls.length = 0;
  vi.clearAllMocks();
  mockTx.shiftAssignment.findMany.mockResolvedValue([]);
  mockTx.shiftAssignment.createManyAndReturn.mockResolvedValue([]);
});

describe("autoAssignShiftGroup preview commit", () => {
  it("commits the preview proposals inside a serialized recheck", async () => {
    vi.mocked(getAutoFillPreview).mockResolvedValue({
      shiftGroupId: "group-1",
      eventId: "event-1",
      eventSummary: "Volleyball",
      generatedAt: "2026-10-01T12:00:00.000Z",
      proposals: [
        {
          shiftId: "shift-1",
          area: "VIDEO",
          workerType: "ST",
          userId: "student-1",
          userName: "Student One",
          userRole: "STUDENT",
          score: 95,
          bucket: "recommended",
          reasons: [],
          warnings: [],
          advisoryConflict: false,
          advisoryConflictNote: null,
        },
        {
          shiftId: "shift-2",
          area: "PHOTO",
          workerType: "ST",
          userId: "student-2",
          userName: "Student Two",
          userRole: "STUDENT",
          score: 70,
          bucket: "warning",
          reasons: [],
          warnings: [{ code: "availability_conflict", label: "Conflicts with class", weight: -25 }],
          advisoryConflict: true,
          advisoryConflictNote: "Conflicts with class",
        },
      ],
      skipped: [],
      summary: { openSlots: 2, proposed: 2, skipped: 0, warnings: 1 },
    });

    mockTx.shiftAssignment.createManyAndReturn.mockResolvedValue([
      {
        id: "assignment-1",
        shiftId: "shift-1",
        userId: "student-1",
        hasConflict: false,
        conflictNote: null,
      },
      {
        id: "assignment-2",
        shiftId: "shift-2",
        userId: "student-2",
        hasConflict: true,
        conflictNote: "Conflicts with class",
      },
    ]);

    const result = await autoAssignShiftGroup("group-1", "staff-1", Role.STAFF);

    expectSerializableIsolation(transactionCalls, 0);
    expect(mockTx.shiftAssignment.findMany).toHaveBeenCalledWith({
      where: {
        shiftId: { in: ["shift-1", "shift-2"] },
        status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
      },
      select: { shiftId: true },
    });
    expect(mockTx.shiftAssignment.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        {
          shiftId: "shift-1",
          userId: "student-1",
          status: "DIRECT_ASSIGNED",
          assignedBy: "staff-1",
          hasConflict: false,
          conflictNote: null,
        },
        {
          shiftId: "shift-2",
          userId: "student-2",
          status: "DIRECT_ASSIGNED",
          assignedBy: "staff-1",
          hasConflict: true,
          conflictNote: "Conflicts with class",
        },
      ],
      select: {
        id: true,
        shiftId: true,
        userId: true,
        hasConflict: true,
        conflictNote: true,
      },
    });
    expect(createAuditEntriesTx).toHaveBeenCalledWith(mockTx, [
      {
        actorId: "staff-1",
        actorRole: Role.STAFF,
        entityType: "shift_assignment",
        entityId: "assignment-1",
        action: "shift_assigned",
        after: {
          shiftId: "shift-1",
          userId: "student-1",
          via: "auto_assign",
          hasConflict: false,
          conflictNote: null,
        },
      },
      {
        actorId: "staff-1",
        actorRole: Role.STAFF,
        entityType: "shift_assignment",
        entityId: "assignment-2",
        action: "shift_assigned",
        after: {
          shiftId: "shift-2",
          userId: "student-2",
          via: "auto_assign",
          hasConflict: true,
          conflictNote: "Conflicts with class",
        },
      },
    ]);
    expect(result).toEqual({ assigned: 2, conflicts: 1, skipped: 0 });
  });

  it("skips preview proposals already filled before commit", async () => {
    vi.mocked(getAutoFillPreview).mockResolvedValue({
      shiftGroupId: "group-1",
      eventId: "event-1",
      eventSummary: "Volleyball",
      generatedAt: "2026-10-01T12:00:00.000Z",
      proposals: [
        {
          shiftId: "shift-1",
          area: "VIDEO",
          workerType: "ST",
          userId: "student-1",
          userName: "Student One",
          userRole: "STUDENT",
          score: 95,
          bucket: "recommended",
          reasons: [],
          warnings: [],
          advisoryConflict: false,
          advisoryConflictNote: null,
        },
      ],
      skipped: [],
      summary: { openSlots: 1, proposed: 1, skipped: 0, warnings: 0 },
    });
    mockTx.shiftAssignment.findMany.mockResolvedValue([{ shiftId: "shift-1" }]);

    const result = await autoAssignShiftGroup("group-1", "staff-1", Role.STAFF);

    expect(mockTx.shiftAssignment.createManyAndReturn).not.toHaveBeenCalled();
    expect(createAuditEntriesTx).not.toHaveBeenCalled();
    expect(result).toEqual({ assigned: 0, conflicts: 0, skipped: 1 });
  });
});
