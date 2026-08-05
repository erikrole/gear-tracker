import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectSerializableIsolation } from "./_helpers/assert-transaction";

const { tx, transactionCalls } = vi.hoisted(() => ({
  tx: {
    shift: { findUnique: vi.fn(), delete: vi.fn() },
    shiftAssignment: { deleteMany: vi.fn() },
    shiftTrade: { updateMany: vi.fn() },
    shiftGroup: { update: vi.fn() },
  },
  transactionCalls: [] as Array<{ options: unknown }>,
}));

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>, options?: unknown) => {
      transactionCalls.push({ options });
      return fn(tx);
    }),
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
  createAuditEntryTx: vi.fn(),
}));
vi.mock("@/lib/schedule-working-copy-guard", () => ({ assertNoWorkingCopy: vi.fn() }));

import { requireAuth } from "@/lib/auth";
import { DELETE as deleteShift } from "@/app/api/shifts/[id]/route";
import { DELETE as deleteGroupShift } from "@/app/api/shift-groups/[id]/shifts/[shiftId]/route";

const staffUser = {
  id: "staff-1",
  role: "STAFF",
  email: "staff@example.com",
  name: "Staff One",
  avatarUrl: null,
  forcePasswordChange: false,
};

function deleteRequest(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "DELETE",
    headers: { host: "app.example.com", origin: "https://app.example.com" },
  });
}

function shiftRow(activeAssignments: number) {
  return {
    id: "shift-1",
    shiftGroupId: "group-1",
    area: "VIDEO",
    workerType: "ST",
    assignments: Array.from({ length: activeAssignments }, (_, i) => ({ id: `assignment-${i}` })),
    shiftGroup: { workingCopy: null },
  };
}

describe("shift delete routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionCalls.length = 0;
    vi.mocked(requireAuth).mockResolvedValue(staffUser as never);
    tx.shift.findUnique.mockResolvedValue(shiftRow(0));
    tx.shift.delete.mockResolvedValue({});
    tx.shiftAssignment.deleteMany.mockResolvedValue({ count: 0 });
    tx.shiftTrade.updateMany.mockResolvedValue({ count: 0 });
    tx.shiftGroup.update.mockResolvedValue({});
  });

  // Both routes read the active-assignment count, decide whether ?force=true is
  // required, then delete — with ShiftAssignment cascading off Shift. At the
  // default Read Committed level a concurrent assignment can commit inside that
  // window, so the force gate passes and a live assignment is cascaded away.
  it("deletes a standalone shift under serializable isolation", async () => {
    const res = await deleteShift(
      deleteRequest("/api/shifts/shift-1"),
      { params: Promise.resolve({ id: "shift-1" }) },
    );

    expect(res.status).toBe(200);
    expectSerializableIsolation(transactionCalls, 0);
  });

  it("deletes a group-scoped shift under serializable isolation", async () => {
    const res = await deleteGroupShift(
      deleteRequest("/api/shift-groups/group-1/shifts/shift-1"),
      { params: Promise.resolve({ id: "group-1", shiftId: "shift-1" }) },
    );

    expect(res.status).toBe(200);
    expectSerializableIsolation(transactionCalls, 0);
  });

  // Removing a slot is manual intent. `manuallyEdited` is the flag that stops
  // regeneration re-adding it, so a delete that skips it lets the next calendar
  // sync silently resurrect the slot staff just removed.
  it("marks the group manually edited when a standalone shift is deleted", async () => {
    await deleteShift(
      deleteRequest("/api/shifts/shift-1"),
      { params: Promise.resolve({ id: "shift-1" }) },
    );

    expect(tx.shiftGroup.update).toHaveBeenCalledWith({
      where: { id: "group-1" },
      data: { manuallyEdited: true },
    });
  });

  it("marks the group manually edited when a group-scoped shift is deleted", async () => {
    await deleteGroupShift(
      deleteRequest("/api/shift-groups/group-1/shifts/shift-1"),
      { params: Promise.resolve({ id: "group-1", shiftId: "shift-1" }) },
    );

    expect(tx.shiftGroup.update).toHaveBeenCalledWith({
      where: { id: "group-1" },
      data: { manuallyEdited: true },
    });
  });

  it("still refuses to delete a staffed shift without force", async () => {
    tx.shift.findUnique.mockResolvedValue(shiftRow(1));

    const res = await deleteShift(
      deleteRequest("/api/shifts/shift-1"),
      { params: Promise.resolve({ id: "shift-1" }) },
    );

    expect(res.status).toBe(409);
    expect(tx.shift.delete).not.toHaveBeenCalled();
  });
});
