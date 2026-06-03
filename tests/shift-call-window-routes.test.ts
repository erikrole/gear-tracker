import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
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
}));

vi.mock("@/lib/services/notifications", () => ({
  createShiftScheduleNotification: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditEntry } from "@/lib/audit";
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

describe("call-window override routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(createShiftScheduleNotification).mockResolvedValue(undefined);
  });

  it("lets staff update a slot call window, audits it, and notifies active assignees", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      id: "shift-1",
      startsAt: new Date("2026-07-07T13:00:00Z"),
      endsAt: new Date("2026-07-07T16:00:00Z"),
      callStartsAt: null,
      callEndsAt: null,
    } as never);
    vi.mocked(db.shift.update).mockResolvedValue({
      id: "shift-1",
      startsAt: new Date("2026-07-07T13:00:00Z"),
      endsAt: new Date("2026-07-07T16:00:00Z"),
      callStartsAt: new Date("2026-07-07T12:30:00Z"),
      callEndsAt: new Date("2026-07-07T15:30:00Z"),
    } as never);
    vi.mocked(db.shiftAssignment.findMany).mockResolvedValue([{ id: "assignment-1" }] as never);

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
      },
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "staff-1",
      entityType: "shift",
      entityId: "shift-1",
      action: "shift_updated",
    }));
    expect(createShiftScheduleNotification).toHaveBeenCalledWith("assignment-1", "shift_time_changed");
  });

  it("rejects partial slot call-window updates", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      id: "shift-1",
      startsAt: new Date("2026-07-07T13:00:00Z"),
      endsAt: new Date("2026-07-07T16:00:00Z"),
      callStartsAt: null,
      callEndsAt: null,
    } as never);

    const res = await patchShift(
      patchRequest("/api/shifts/shift-1", {
        callStartsAt: "2026-07-07T12:30:00.000Z",
      }),
      routeParams("shift-1"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("callStartsAt and callEndsAt must both be provided or both omitted");
    expect(db.shift.update).not.toHaveBeenCalled();
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
