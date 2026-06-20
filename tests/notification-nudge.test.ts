import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    shiftAssignment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/notifications", () => ({
  createShiftGearUpNotification: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createShiftGearUpNotification } from "@/lib/services/notifications";
import { POST } from "@/app/api/notifications/nudge/route";

const staffUser = {
  id: "staff-1",
  email: "staff@test.com",
  name: "Staff",
  role: Role.STAFF,
  avatarUrl: null,
};

const studentUser = {
  id: "student-1",
  email: "student@test.com",
  name: "Student",
  role: Role.STUDENT,
  avatarUrl: null,
};

function shiftAssignment(row: unknown) {
  return row as Awaited<ReturnType<typeof db.shiftAssignment.findUnique>>;
}

function makePostRequest(assignmentId = "cmassignment000000000000001") {
  return new Request("https://app.example.com/api/notifications/nudge", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify({ assignmentId }),
  });
}

function activeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "cmassignment000000000000001",
    userId: "student-target",
    status: "DIRECT_ASSIGNED",
    shift: {
      endsAt: new Date(Date.now() + 60 * 60_000),
      shiftGroup: { archivedAt: null },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(enforceRateLimit).mockResolvedValue(undefined);
});

describe("POST /api/notifications/nudge", () => {
  it("blocks STUDENT callers before rate limiting", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await POST(makePostRequest(), { params: Promise.resolve({}) });

    expect(res.status).toBe(403);
    expect(enforceRateLimit).not.toHaveBeenCalled();
    expect(createShiftGearUpNotification).not.toHaveBeenCalled();
  });

  it("requires an active future assignment before nudging", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.shiftAssignment.findUnique).mockResolvedValue(shiftAssignment(activeAssignment({ status: "DECLINED" })));

    const res = await POST(makePostRequest(), { params: Promise.resolve({}) });

    expect(res.status).toBe(409);
    expect(createShiftGearUpNotification).not.toHaveBeenCalled();
  });

  it("applies actor, assignment, and recipient nudge rate limits", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.shiftAssignment.findUnique).mockResolvedValue(shiftAssignment(activeAssignment()));

    const res = await POST(makePostRequest(), { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(enforceRateLimit).toHaveBeenCalledWith(
      "notifications:nudge:staff-1",
      { max: 20, windowMs: 60_000 },
    );
    expect(enforceRateLimit).toHaveBeenCalledWith(
      "notifications:nudge:staff-1:hour",
      { max: 60, windowMs: 60 * 60_000 },
    );
    expect(enforceRateLimit).toHaveBeenCalledWith(
      "notifications:nudge:assignment:cmassignment000000000000001",
      { max: 2, windowMs: 60 * 60_000 },
    );
    expect(enforceRateLimit).toHaveBeenCalledWith(
      "notifications:nudge:recipient:student-target",
      { max: 5, windowMs: 60 * 60_000 },
    );
    expect(createShiftGearUpNotification).toHaveBeenCalledWith(
      "cmassignment000000000000001",
      { source: "manual_nudge" },
    );
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "staff-1",
        entityType: "shift_assignment",
        entityId: "cmassignment000000000000001",
        action: "nudge_sent",
      }),
    );
  });
});
