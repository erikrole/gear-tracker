import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeShiftAssignment, makeShift } from "./_helpers/factories";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

// ─── Transaction tracking ──────────��────────────────────────────────────────
const transactionCalls: Array<{ options: unknown }> = [];

// ─── Mock @/lib/db ───────────────��──────────────────────────────────────────
vi.mock("@/lib/db", () => {
  const mockTx = {
    shift: {
      findUnique: vi.fn(),
    },
    shiftAssignment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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

// ─── Mock checkTimeConflict self-reference (used internally) ────────────────
// The service imports checkTimeConflict from itself, so we let the real
// module load and only mock the db dependency above.

import { db } from "@/lib/db";
import {
  directAssignShift,
  requestShift,
  approveRequest,
  declineRequest,
  initiateSwap,
  removeAssignment,
} from "@/lib/services/shift-assignments";

const mockTx = (db as any)._mockTx;

beforeEach(() => {
  transactionCalls.length = 0;
});

// ════════════��═══════════════════════════════════���════════════════════════════
// directAssignShift
// ════════���════════════════════════════════════════════════════════════════════
describe("directAssignShift", () => {
  const shift = makeShift();

  it("creates a DIRECT_ASSIGNED assignment", async () => {
    mockTx.shift.findUnique.mockResolvedValue(shift);
    mockTx.shiftAssignment.findFirst.mockResolvedValue(null);
    mockTx.shiftAssignment.updateMany.mockResolvedValue({ count: 0 });
    mockTx.shiftAssignment.create.mockResolvedValue({
      id: "sa-1",
      shiftId: shift.id,
      userId: "user-1",
      status: "DIRECT_ASSIGNED",
    });

    const result = await directAssignShift(shift.id, "user-1", "admin-1");

    expect(mockTx.shiftAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shiftId: shift.id,
          userId: "user-1",
          status: "DIRECT_ASSIGNED",
          assignedBy: "admin-1",
        }),
      })
    );
    expect(result.id).toBe("sa-1");
  });

  it("uses SERIALIZABLE isolation", async () => {
    mockTx.shift.findUnique.mockResolvedValue(shift);
    mockTx.shiftAssignment.findFirst.mockResolvedValue(null);
    mockTx.shiftAssignment.updateMany.mockResolvedValue({ count: 0 });
    mockTx.shiftAssignment.create.mockResolvedValue({ id: "sa-1" });

    await directAssignShift(shift.id, "user-1", "admin-1");

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("throws 404 when shift not found", async () => {
    mockTx.shift.findUnique.mockResolvedValue(null);

    await expect(directAssignShift("bad-id", "user-1", "admin-1")).rejects.toThrow(
      "Shift not found"
    );
  });

  it("throws 409 when shift already has an active assignment", async () => {
    mockTx.shift.findUnique.mockResolvedValue(shift);
    mockTx.shiftAssignment.findFirst.mockResolvedValue(
      makeShiftAssignment({ status: "DIRECT_ASSIGNED" })
    );

    await expect(directAssignShift(shift.id, "user-1", "admin-1")).rejects.toThrow(
      "already has an active assignment"
    );
  });

  it("declines pending REQUESTED assignments on the same shift", async () => {
    mockTx.shift.findUnique.mockResolvedValue(shift);
    // First call: check for active assignment → none
    // Second call: checkTimeConflict → none
    mockTx.shiftAssignment.findFirst
      .mockResolvedValueOnce(null)  // no active assignment
      .mockResolvedValueOnce(null); // no time conflict
    mockTx.shiftAssignment.updateMany.mockResolvedValue({ count: 2 });
    mockTx.shiftAssignment.create.mockResolvedValue({ id: "sa-1" });

    await directAssignShift(shift.id, "user-1", "admin-1");

    expect(mockTx.shiftAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shiftId: shift.id,
          status: "REQUESTED",
        }),
        data: { status: "DECLINED" },
      })
    );
  });
});

// ══════��════════════════��═════════════════════════════════════════════════════
// requestShift
// ═══════��═════════════════════════════════════════════════════════════════════
describe("requestShift", () => {
  const shiftGroup = { isPremier: true };
  const shift = { ...makeShift(), shiftGroup };

  it("creates a REQUESTED assignment for premier shift", async () => {
    mockTx.shift.findUnique.mockResolvedValue(shift);
    mockTx.shiftAssignment.findFirst
      .mockResolvedValueOnce(null)  // no active assignment
      .mockResolvedValueOnce(null)  // no existing request
      .mockResolvedValueOnce(null); // no time conflict
    mockTx.shiftAssignment.create.mockResolvedValue({
      id: "sa-1",
      status: "REQUESTED",
    });

    const result = await requestShift(shift.id, "student-1");

    expect(mockTx.shiftAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shiftId: shift.id,
          userId: "student-1",
          status: "REQUESTED",
        }),
      })
    );
  });

  it("uses SERIALIZABLE isolation", async () => {
    mockTx.shift.findUnique.mockResolvedValue(shift);
    mockTx.shiftAssignment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockTx.shiftAssignment.create.mockResolvedValue({ id: "sa-1" });

    await requestShift(shift.id, "student-1");

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("throws 404 when shift not found", async () => {
    mockTx.shift.findUnique.mockResolvedValue(null);

    await expect(requestShift("bad-id", "student-1")).rejects.toThrow("Shift not found");
  });

  it("throws 400 when shift group is not premier", async () => {
    mockTx.shift.findUnique.mockResolvedValue({
      ...makeShift(),
      shiftGroup: { isPremier: false },
    });

    await expect(requestShift("shift-1", "student-1")).rejects.toThrow(
      "only available for premier"
    );
  });

  it("throws 409 when shift already has an active assignment", async () => {
    mockTx.shift.findUnique.mockResolvedValue(shift);
    mockTx.shiftAssignment.findFirst.mockResolvedValue(
      makeShiftAssignment({ status: "DIRECT_ASSIGNED" })
    );

    await expect(requestShift(shift.id, "student-1")).rejects.toThrow(
      "already has an active assignment"
    );
  });

  it("throws 409 when user already requested", async () => {
    mockTx.shift.findUnique.mockResolvedValue(shift);
    mockTx.shiftAssignment.findFirst
      .mockResolvedValueOnce(null) // no active assignment
      .mockResolvedValueOnce(makeShiftAssignment({ status: "REQUESTED" })); // already requested

    await expect(requestShift(shift.id, "student-1")).rejects.toThrow(
      "already requested"
    );
  });
});

// ═══��════════════════════════════════════════════════════���════════════════════
// approveRequest
// ��═══════════════════════════════��═════════════════════════════════════════��══
describe("approveRequest", () => {
  const shift = makeShift();

  it("approves a REQUESTED assignment", async () => {
    const assignment = {
      ...makeShiftAssignment({ status: "REQUESTED", userId: "student-1" }),
      shift,
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.findFirst
      .mockResolvedValueOnce(null)  // no time conflict
      .mockResolvedValueOnce(null); // no active assignment on shift
    mockTx.shiftAssignment.updateMany.mockResolvedValue({ count: 0 });
    mockTx.shiftAssignment.update.mockResolvedValue({
      ...assignment,
      status: "APPROVED",
    });

    const result = await approveRequest(assignment.id);

    expect(mockTx.shiftAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "APPROVED" },
      })
    );
    expect(result.status).toBe("APPROVED");
  });

  it("uses SERIALIZABLE isolation", async () => {
    const assignment = {
      ...makeShiftAssignment({ status: "REQUESTED" }),
      shift,
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockTx.shiftAssignment.updateMany.mockResolvedValue({ count: 0 });
    mockTx.shiftAssignment.update.mockResolvedValue({ ...assignment, status: "APPROVED" });

    await approveRequest(assignment.id);

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("throws 404 when assignment not found", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue(null);

    await expect(approveRequest("bad-id")).rejects.toThrow("Assignment not found");
  });

  it("throws 400 when assignment is not REQUESTED", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue({
      ...makeShiftAssignment({ status: "DIRECT_ASSIGNED" }),
      shift,
    });

    await expect(approveRequest("sa-1")).rejects.toThrow("Only REQUESTED");
  });

  it("declines other REQUESTED assignments on the same shift", async () => {
    const assignment = {
      ...makeShiftAssignment({ status: "REQUESTED", shiftId: "shift-1" }),
      shift,
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockTx.shiftAssignment.updateMany.mockResolvedValue({ count: 3 });
    mockTx.shiftAssignment.update.mockResolvedValue({ ...assignment, status: "APPROVED" });

    await approveRequest(assignment.id);

    expect(mockTx.shiftAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shiftId: assignment.shiftId,
          status: "REQUESTED",
          id: { not: assignment.id },
        }),
        data: { status: "DECLINED" },
      })
    );
  });
});

// ═════���═══════════════════════════════════════════════════════════���═══════════
// declineRequest
// ═════════════════════════════════════════════════════════════════════════════
describe("declineRequest", () => {
  it("declines a REQUESTED assignment", async () => {
    const assignment = makeShiftAssignment({ status: "REQUESTED" });
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.update.mockResolvedValue({
      ...assignment,
      status: "DECLINED",
    });

    const result = await declineRequest(assignment.id);

    expect(mockTx.shiftAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "DECLINED" },
      })
    );
  });

  it("uses SERIALIZABLE isolation", async () => {
    const assignment = makeShiftAssignment({ status: "REQUESTED" });
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.update.mockResolvedValue({ ...assignment, status: "DECLINED" });

    await declineRequest(assignment.id);

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("throws 404 when assignment not found", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue(null);

    await expect(declineRequest("bad-id")).rejects.toThrow("Assignment not found");
  });

  it("throws 400 when assignment is not REQUESTED", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue(
      makeShiftAssignment({ status: "APPROVED" })
    );

    await expect(declineRequest("sa-1")).rejects.toThrow("Only REQUESTED");
  });
});

// ═���════════════════���══════════════════════════════════════════════════════════
// initiateSwap
// ═���════════════════════════���══════════════════════════════════���═══════════════
describe("initiateSwap", () => {
  const shift = makeShift();

  it("swaps an active assignment to a new user", async () => {
    const assignment = {
      ...makeShiftAssignment({ status: "DIRECT_ASSIGNED", shiftId: shift.id }),
      shift,
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.findFirst.mockResolvedValue(null); // no time conflict
    mockTx.shiftAssignment.update.mockResolvedValue({
      ...assignment,
      status: "SWAPPED",
    });
    mockTx.shiftAssignment.create.mockResolvedValue({
      id: "sa-new",
      shiftId: shift.id,
      userId: "target-1",
      status: "DIRECT_ASSIGNED",
    });

    const result = await initiateSwap(assignment.id, "target-1", "admin-1");

    expect(mockTx.shiftAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "SWAPPED" },
      })
    );
    expect(mockTx.shiftAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shiftId: shift.id,
          userId: "target-1",
          status: "DIRECT_ASSIGNED",
          assignedBy: "admin-1",
          swapFromId: assignment.id,
        }),
      })
    );
  });

  it("uses SERIALIZABLE isolation", async () => {
    const assignment = {
      ...makeShiftAssignment({ status: "DIRECT_ASSIGNED" }),
      shift,
    };
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.findFirst.mockResolvedValue(null);
    mockTx.shiftAssignment.update.mockResolvedValue({});
    mockTx.shiftAssignment.create.mockResolvedValue({ id: "sa-new" });

    await initiateSwap(assignment.id, "target-1", "admin-1");

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("throws 404 when assignment not found", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue(null);

    await expect(initiateSwap("bad-id", "target-1", "admin-1")).rejects.toThrow(
      "Assignment not found"
    );
  });

  it("throws 400 when assignment is not active", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue({
      ...makeShiftAssignment({ status: "SWAPPED" }),
      shift,
    });

    await expect(initiateSwap("sa-1", "target-1", "admin-1")).rejects.toThrow(
      "Only active assignments"
    );
  });

  it("throws 400 for DECLINED assignment", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue({
      ...makeShiftAssignment({ status: "DECLINED" }),
      shift,
    });

    await expect(initiateSwap("sa-1", "target-1", "admin-1")).rejects.toThrow(
      "Only active assignments"
    );
  });
});

// ��═════════════════════════════════════════════════════════���══════════════════
// removeAssignment
// ═════════════════════════════════���═══════════════════════════════════════════
describe("removeAssignment", () => {
  it("removes a DIRECT_ASSIGNED assignment", async () => {
    const assignment = makeShiftAssignment({ status: "DIRECT_ASSIGNED" });
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.update.mockResolvedValue({
      ...assignment,
      status: "DECLINED",
    });

    const result = await removeAssignment(assignment.id);

    expect(mockTx.shiftAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "DECLINED" },
      })
    );
  });

  it("removes an APPROVED assignment", async () => {
    const assignment = makeShiftAssignment({ status: "APPROVED" });
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.update.mockResolvedValue({ ...assignment, status: "DECLINED" });

    await removeAssignment(assignment.id);

    expect(mockTx.shiftAssignment.update).toHaveBeenCalled();
  });

  it("removes a REQUESTED assignment", async () => {
    const assignment = makeShiftAssignment({ status: "REQUESTED" });
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.update.mockResolvedValue({ ...assignment, status: "DECLINED" });

    await removeAssignment(assignment.id);

    expect(mockTx.shiftAssignment.update).toHaveBeenCalled();
  });

  it("uses SERIALIZABLE isolation", async () => {
    const assignment = makeShiftAssignment({ status: "DIRECT_ASSIGNED" });
    mockTx.shiftAssignment.findUnique.mockResolvedValue(assignment);
    mockTx.shiftAssignment.update.mockResolvedValue({ ...assignment, status: "DECLINED" });

    await removeAssignment(assignment.id);

    expectSerializableIsolation(transactionCalls, 0);
  });

  it("throws 404 when assignment not found", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue(null);

    await expect(removeAssignment("bad-id")).rejects.toThrow("Assignment not found");
  });

  it("throws 400 for SWAPPED status (terminal)", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue(
      makeShiftAssignment({ status: "SWAPPED" })
    );

    await expect(removeAssignment("sa-1")).rejects.toThrow("cannot be removed");
  });

  it("throws 400 for DECLINED status (terminal)", async () => {
    mockTx.shiftAssignment.findUnique.mockResolvedValue(
      makeShiftAssignment({ status: "DECLINED" })
    );

    await expect(removeAssignment("sa-1")).rejects.toThrow("cannot be removed");
  });
});
