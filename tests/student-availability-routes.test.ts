import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    studentAvailabilityBlock: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    shift: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    enforceRateLimit: vi.fn(),
  };
});

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditEntry } from "@/lib/audit";
import { POST as createAvailability } from "@/app/api/users/[id]/availability/route";
import {
  DELETE as deleteAvailability,
  PATCH as updateAvailability,
} from "@/app/api/users/[id]/availability/[blockId]/route";
import { GET as getShiftConflicts } from "@/app/api/shifts/[id]/conflicts/route";

const studentUser = {
  id: "student-1",
  email: "student@example.com",
  name: "Student One",
  role: "STUDENT" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};

const staffUser = {
  ...studentUser,
  id: "staff-1",
  role: "STAFF" as const,
};

function jsonRequest(path: string, method: string, body?: unknown) {
  return new Request(`https://app.example.com${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) };
}

describe("student availability routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(studentUser);
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "student-1", role: "STUDENT" } as never);
  });

  it("lets a student create an ad hoc conflict for themself and audits it", async () => {
    vi.mocked(db.studentAvailabilityBlock.create).mockResolvedValue({
      id: "block-1",
      userId: "student-1",
      kind: "AD_HOC",
      dayOfWeek: null,
      date: new Date("2026-10-06T00:00:00.000Z"),
      startsAt: "10:00",
      endsAt: "11:00",
      label: "Exam",
      semesterLabel: null,
      semesterStartsOn: null,
      semesterEndsOn: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await createAvailability(
      jsonRequest("/api/users/student-1/availability", "POST", {
        kind: "AD_HOC",
        date: "2026-10-06",
        startsAt: "10:00",
        endsAt: "11:00",
        label: "Exam",
      }),
      params({ id: "student-1" }),
    );

    expect(res.status).toBe(201);
    expect(db.studentAvailabilityBlock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "student-1",
        kind: "AD_HOC",
        dayOfWeek: null,
        date: new Date("2026-10-06T00:00:00.000Z"),
      }),
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "student-1",
      entityType: "student_availability_block",
      action: "student_availability_created",
    }));
  });

  it("denies students editing another student's availability", async () => {
    const res = await createAvailability(
      jsonRequest("/api/users/student-2/availability", "POST", {
        kind: "WEEKLY",
        dayOfWeek: 1,
        startsAt: "09:00",
        endsAt: "10:00",
      }),
      params({ id: "student-2" }),
    );

    expect(res.status).toBe(403);
    expect(db.studentAvailabilityBlock.create).not.toHaveBeenCalled();
  });

  it("lets staff update a weekly semester block and audits before and after", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.studentAvailabilityBlock.findUnique).mockResolvedValueOnce({
      id: "block-1",
      userId: "student-1",
      kind: "WEEKLY",
      dayOfWeek: 1,
      date: null,
      startsAt: "09:00",
      endsAt: "10:00",
      label: "Old",
      semesterLabel: null,
      semesterStartsOn: null,
      semesterEndsOn: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(db.studentAvailabilityBlock.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.studentAvailabilityBlock.findUnique).mockResolvedValueOnce({
      id: "block-1",
      userId: "student-1",
      kind: "WEEKLY",
      dayOfWeek: 2,
      date: null,
      startsAt: "09:30",
      endsAt: "10:45",
      label: "COMM 201",
      semesterLabel: "Fall 2026",
      semesterStartsOn: new Date("2026-08-24T00:00:00.000Z"),
      semesterEndsOn: new Date("2026-12-18T00:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await updateAvailability(
      jsonRequest("/api/users/student-1/availability/block-1", "PATCH", {
        kind: "WEEKLY",
        dayOfWeek: 2,
        startsAt: "09:30",
        endsAt: "10:45",
        label: "COMM 201",
        semesterLabel: "Fall 2026",
        semesterStartsOn: "2026-08-24",
        semesterEndsOn: "2026-12-18",
      }),
      params({ id: "student-1", blockId: "block-1" }),
    );

    expect(res.status).toBe(200);
    expect(db.studentAvailabilityBlock.updateMany).toHaveBeenCalledWith({
      where: { id: "block-1", userId: "student-1" },
      data: expect.objectContaining({
        kind: "WEEKLY",
        dayOfWeek: 2,
        semesterStartsOn: new Date("2026-08-24T00:00:00.000Z"),
        semesterEndsOn: new Date("2026-12-18T00:00:00.000Z"),
      }),
    });
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorId: "staff-1",
      action: "student_availability_updated",
      before: expect.objectContaining({ label: "Old" }),
      after: expect.objectContaining({ label: "COMM 201" }),
    }));
  });

  it("returns 404 when a block disappears before update", async () => {
    vi.mocked(db.studentAvailabilityBlock.findUnique).mockResolvedValue({
      id: "block-1",
      userId: "student-1",
      kind: "WEEKLY",
      dayOfWeek: 1,
      date: null,
      startsAt: "09:00",
      endsAt: "10:00",
      label: "Old",
      semesterLabel: null,
      semesterStartsOn: null,
      semesterEndsOn: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(db.studentAvailabilityBlock.updateMany).mockResolvedValue({ count: 0 } as never);

    const res = await updateAvailability(
      jsonRequest("/api/users/student-1/availability/block-1", "PATCH", {
        kind: "WEEKLY",
        dayOfWeek: 2,
        startsAt: "09:30",
        endsAt: "10:45",
      }),
      params({ id: "student-1", blockId: "block-1" }),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Block not found");
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("returns 404 when a block disappears before delete", async () => {
    vi.mocked(db.studentAvailabilityBlock.findUnique).mockResolvedValue({
      id: "block-1",
      userId: "student-1",
      kind: "WEEKLY",
      dayOfWeek: 1,
      date: null,
      startsAt: "09:00",
      endsAt: "10:00",
      label: "Old",
      semesterLabel: null,
      semesterStartsOn: null,
      semesterEndsOn: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(db.studentAvailabilityBlock.deleteMany).mockResolvedValue({ count: 0 } as never);

    const res = await deleteAvailability(
      jsonRequest("/api/users/student-1/availability/block-1", "DELETE"),
      params({ id: "student-1", blockId: "block-1" }),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Block not found");
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("rejects weekly blocks without a weekday", async () => {
    const res = await createAvailability(
      jsonRequest("/api/users/student-1/availability", "POST", {
        kind: "WEEKLY",
        startsAt: "09:00",
        endsAt: "10:00",
      }),
      params({ id: "student-1" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Day of week is required for weekly availability");
  });
});

describe("shift conflict route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
  });

  it("returns conflicts from weekly and ad hoc blocks using the effective slot call window", async () => {
    vi.mocked(db.shift.findUnique).mockResolvedValue({
      id: "shift-1",
      startsAt: new Date("2026-10-06T13:00:00.000Z"),
      endsAt: new Date("2026-10-06T16:00:00.000Z"),
      callStartsAt: new Date("2026-10-06T15:15:00.000Z"),
      callEndsAt: new Date("2026-10-06T15:45:00.000Z"),
    } as never);
    vi.mocked(db.user.findMany).mockResolvedValue([
      {
        id: "student-1",
        availabilityBlocks: [{
          kind: "AD_HOC",
          dayOfWeek: null,
          date: new Date("2026-10-06T00:00:00.000Z"),
          startsAt: "10:00",
          endsAt: "11:00",
          label: "Exam",
          semesterLabel: null,
          semesterStartsOn: null,
          semesterEndsOn: null,
        }],
      },
      {
        id: "student-2",
        availabilityBlocks: [{
          kind: "WEEKLY",
          dayOfWeek: 2,
          date: null,
          startsAt: "10:30",
          endsAt: "12:00",
          label: "COMM 201",
          semesterLabel: "Fall 2026",
          semesterStartsOn: new Date("2026-08-24T00:00:00.000Z"),
          semesterEndsOn: new Date("2026-12-18T00:00:00.000Z"),
        }],
      },
    ] as never);

    const res = await getShiftConflicts(
      new Request("https://app.example.com/api/shifts/shift-1/conflicts", {
        headers: { host: "app.example.com" },
      }),
      params({ id: "shift-1" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      "student-1": "Conflicts with Exam (10:00-11:00)",
      "student-2": "Conflicts with COMM 201 (10:30-12:00)",
    });
  });
});
