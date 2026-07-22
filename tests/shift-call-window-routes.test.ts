import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  after: vi.fn(),
  scheduleShiftTimeChangedNotifications: vi.fn(),
  updateShiftAssignmentConflictsTx: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: routeMocks.after,
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
    shift: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    shiftAssignment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
  createAuditEntryTx: vi.fn(),
}));

vi.mock("@/lib/services/notifications", () => ({
  createShiftScheduleNotification: vi.fn(),
}));

vi.mock("@/lib/shift-notification-workflow", () => ({
  scheduleShiftTimeChangedNotifications: routeMocks.scheduleShiftTimeChangedNotifications,
}));

vi.mock("@/lib/services/shift-assignment-conflicts", () => ({
  updateShiftAssignmentConflictsTx: routeMocks.updateShiftAssignmentConflictsTx,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditEntry, createAuditEntryTx } from "@/lib/audit";
import { createShiftScheduleNotification } from "@/lib/services/notifications";
import { PATCH as patchShift } from "@/app/api/shifts/[id]/route";
import { PATCH as patchAssignment } from "@/app/api/shift-assignments/[id]/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: "STAFF" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};

const studentUser = {
  ...staffUser,
  id: "student-1",
  role: "STUDENT" as const,
};

function patchRequest(path: string, body: unknown) {
  return new Request(`https://app.example.com${path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function shiftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift-1",
    startsAt: new Date("2026-07-07T13:00:00Z"),
    endsAt: new Date("2026-07-07T16:00:00Z"),
    callStartsAt: null,
    callEndsAt: null,
    shiftGroup: { publishedAt: new Date("2026-07-01T12:00:00Z") },
    ...overrides,
  };
}

function assignmentRow(id: string) {
  return {
    id,
    callStartsAt: null,
    callEndsAt: null,
    user: {
      role: "STUDENT",
      staffingType: "ST",
      availabilityBlocks: [],
    },
  };
}

describe("call-window override routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.after.mockImplementation((callback: () => Promise<unknown>) => {
      void callback();
    });
    routeMocks.scheduleShiftTimeChangedNotifications.mockResolvedValue("run-1");
    routeMocks.updateShiftAssignmentConflictsTx.mockResolvedValue(undefined);
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(createShiftScheduleNotification).mockResolvedValue(undefined);
    vi.mocked(createAuditEntryTx).mockResolvedValue(undefined);
    vi.mocked(db.$transaction).mockImplementation((async (callback: unknown) => (
      callback as (tx: typeof db) => Promise<unknown>
    )(db)) as never);
  });

  it("lets staff update a slot call window, audits it, and notifies active assignees", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue(shiftRow() as never);
    vi.mocked(db.shift.update).mockResolvedValue(shiftRow({
      callStartsAt: new Date("2026-07-07T12:30:00Z"),
      callEndsAt: new Date("2026-07-07T15:30:00Z"),
    }) as never);
    vi.mocked(db.shiftAssignment.findMany).mockResolvedValue([assignmentRow("assignment-1")] as never);

    const res = await patchShift(
      patchRequest("/api/shifts/shift-1", {
        callStartsAt: "2026-07-07T12:30:00.000Z",
        callEndsAt: "2026-07-07T15:30:00.000Z",
      }),
      routeParams("shift-1"),
    );

    expect(res.status).toBe(200);
    expect(db.shift.update).toHaveBeenCalledWith({
      where: { id: "shift-1" },
      data: {
        callStartsAt: new Date("2026-07-07T12:30:00.000Z"),
        callEndsAt: new Date("2026-07-07T15:30:00.000Z"),
        templateManaged: false,
      },
    });
    expect(createAuditEntryTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "staff-1",
        entityType: "shift",
        entityId: "shift-1",
        action: "shift_updated",
      }),
    );
    expect(routeMocks.updateShiftAssignmentConflictsTx).toHaveBeenCalledWith(
      expect.anything(),
      [{ id: "assignment-1", hasConflict: false, conflictNote: null }],
      true,
    );
    expect(routeMocks.after).toHaveBeenCalledOnce();
    expect(routeMocks.scheduleShiftTimeChangedNotifications).toHaveBeenCalledWith(["assignment-1"]);
  });

  it("rejects partial slot call-window updates", async () => {
    const res = await patchShift(
      patchRequest("/api/shifts/shift-1", {
        callStartsAt: "2026-07-07T12:30:00.000Z",
      }),
      routeParams("shift-1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("callStartsAt and callEndsAt must both be provided or both omitted");
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.shift.update).not.toHaveBeenCalled();
  });

  it("BUG: a batched conflict refresh failure rejects the Serializable shift transaction without a success response", async () => {
    const tx = {
      shift: {
        findUnique: vi.fn().mockResolvedValue(shiftRow()),
        update: vi.fn().mockResolvedValue(shiftRow({
          callStartsAt: new Date("2026-07-07T12:30:00Z"),
          callEndsAt: new Date("2026-07-07T15:30:00Z"),
        })),
      },
      shiftAssignment: {
        findMany: vi.fn().mockResolvedValue([
          assignmentRow("assignment-1"),
          assignmentRow("assignment-2"),
        ]),
      },
    };
    routeMocks.updateShiftAssignmentConflictsTx.mockRejectedValueOnce(new Error("assignment refresh failed"));
    let transactionRejected = false;
    vi.mocked(db.$transaction).mockImplementationOnce((async (callback: unknown) => {
      try {
        return await (callback as (client: typeof tx) => Promise<unknown>)(tx);
      } catch (error) {
        transactionRejected = true;
        throw error;
      }
    }) as never);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await patchShift(
      patchRequest("/api/shifts/shift-1", {
        callStartsAt: "2026-07-07T12:30:00.000Z",
        callEndsAt: "2026-07-07T15:30:00.000Z",
      }),
      routeParams("shift-1"),
    );
    consoleError.mockRestore();
    const body = await res.json();

    expect(transactionRejected).toBe(true);
    expect(res.status).toBe(500);
    expect(body).not.toHaveProperty("data");
    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
    expect(tx.shift.update).toHaveBeenCalledOnce();
    expect(routeMocks.updateShiftAssignmentConflictsTx).toHaveBeenCalledOnce();
    expect(db.shift.update).not.toHaveBeenCalled();
    expect(db.shiftAssignment.update).not.toHaveBeenCalled();
    expect(createAuditEntryTx).not.toHaveBeenCalled();
    expect(routeMocks.after).not.toHaveBeenCalled();
    expect(routeMocks.scheduleShiftTimeChangedNotifications).not.toHaveBeenCalled();
  });

  it("BUG: one-bound validation uses the live shift row inside the transaction", async () => {
    const txShiftFindUnique = vi.fn().mockResolvedValue(shiftRow({
      startsAt: new Date("2026-07-07T15:00:00Z"),
    }));
    const txShiftUpdate = vi.fn();
    const tx = {
      shift: {
        findUnique: txShiftFindUnique,
        update: txShiftUpdate,
      },
      shiftAssignment: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    vi.mocked(db.shift.findUnique).mockResolvedValue(shiftRow() as never);
    vi.mocked(db.shift.update).mockResolvedValue(shiftRow({
      endsAt: new Date("2026-07-07T14:00:00Z"),
    }) as never);
    vi.mocked(db.shiftAssignment.findMany).mockResolvedValue([] as never);
    vi.mocked(db.$transaction).mockImplementationOnce((async (callback: unknown) => (
      callback as (client: typeof tx) => Promise<unknown>
    )(tx)) as never);

    const res = await patchShift(
      patchRequest("/api/shifts/shift-1", {
        endsAt: "2026-07-07T14:00:00.000Z",
      }),
      routeParams("shift-1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("endsAt must be after startsAt");
    expect(db.shift.findUnique).not.toHaveBeenCalled();
    expect(txShiftFindUnique).toHaveBeenCalledWith({
      where: { id: "shift-1" },
      include: { shiftGroup: { select: { publishedAt: true } } },
    });
    expect(txShiftUpdate).not.toHaveBeenCalled();
    expect(createAuditEntryTx).not.toHaveBeenCalled();
  });

  it("lets staff update a personal assignment call window, audits it, and sends personal notification", async () => {
    vi.mocked(db.shiftAssignment.findUnique).mockResolvedValue({
      id: "assignment-1",
      callStartsAt: null,
      callEndsAt: null,
      callNote: null,
    } as never);
    vi.mocked(db.shiftAssignment.update).mockResolvedValue({
      id: "assignment-1",
      callStartsAt: new Date("2026-07-07T14:15:00Z"),
      callEndsAt: new Date("2026-07-07T15:30:00Z"),
      callNote: null,
    } as never);

    const res = await patchAssignment(
      patchRequest("/api/shift-assignments/assignment-1", {
        callStartsAt: "2026-07-07T14:15:00.000Z",
        callEndsAt: "2026-07-07T15:30:00.000Z",
      }),
      routeParams("assignment-1"),
    );

    expect(res.status).toBe(200);
    expect(db.shiftAssignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: {
        callStartsAt: new Date("2026-07-07T14:15:00.000Z"),
        callEndsAt: new Date("2026-07-07T15:30:00.000Z"),
      },
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "shift_assignment",
      entityId: "assignment-1",
      action: "shift_assignment_updated",
    }));
    expect(createShiftScheduleNotification).toHaveBeenCalledWith("assignment-1", "personal_call_time_changed");
  });

  it("denies students from changing assignment call windows", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await patchAssignment(
      patchRequest("/api/shift-assignments/assignment-1", {
        callStartsAt: "2026-07-07T14:15:00.000Z",
        callEndsAt: "2026-07-07T15:30:00.000Z",
      }),
      routeParams("assignment-1"),
    );

    expect(res.status).toBe(403);
    expect(db.shiftAssignment.update).not.toHaveBeenCalled();
  });
});
