import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx } = vi.hoisted(() => ({
  tx: {
    calendarEvent: { findUnique: vi.fn() },
    sportConfig: { findUnique: vi.fn() },
    shiftGroup: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
    shift: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    shiftGroup: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { POST } from "@/app/api/shift-groups/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: "STAFF" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};

function postRequest(body: string) {
  return new Request("https://app.example.com/api/shift-groups", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body,
  });
}

describe("POST /api/shift-groups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    tx.shift.createMany.mockResolvedValue({ count: 0 });
    tx.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  it("rejects malformed JSON before creating a shift group", async () => {
    const res = await POST(postRequest("{not-json"), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects missing eventId before creating a shift group", async () => {
    const res = await POST(postRequest(JSON.stringify({})), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("eventId required");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("creates saved Home crew defaults with template-managed slots", async () => {
    tx.calendarEvent.findUnique.mockResolvedValue({
      id: "event-1",
      sportCode: "FB",
      startsAt: new Date("2026-09-06T23:30:00Z"),
      endsAt: new Date("2026-09-07T02:30:00Z"),
    });
    tx.sportConfig.findUnique.mockResolvedValue({
      active: true,
      shiftStartOffset: 60,
      shiftEndOffset: 30,
      shiftConfigs: [{
        area: "VIDEO",
        homeCount: 2,
        awayCount: 1,
        homeStaffCount: 1,
        homeStudentCount: 1,
        awayStaffCount: 0,
        awayStudentCount: 1,
      }],
    });
    tx.shiftGroup.create.mockResolvedValue({ id: "group-1" });
    tx.shiftGroup.findUniqueOrThrow.mockResolvedValue({
      id: "group-1",
      eventId: "event-1",
      publishedAt: null,
      publishedById: null,
      lastPublishedSnapshot: null,
      event: { id: "event-1" },
      shifts: [
        {
          id: "shift-ft",
          area: "VIDEO",
          workerType: "FT",
          startsAt: new Date("2026-09-06T22:30:00Z"),
          endsAt: new Date("2026-09-07T03:00:00Z"),
          callStartsAt: null,
          callEndsAt: null,
          assignments: [],
        },
        {
          id: "shift-st",
          area: "VIDEO",
          workerType: "ST",
          startsAt: new Date("2026-09-06T22:30:00Z"),
          endsAt: new Date("2026-09-07T03:00:00Z"),
          callStartsAt: null,
          callEndsAt: null,
          assignments: [],
        },
      ],
    });

    const res = await POST(postRequest(JSON.stringify({ eventId: "event-1", templateSide: "HOME" })), {
      params: Promise.resolve({}),
    });

    expect(res.status).toBe(200);
    expect(tx.shift.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ area: "VIDEO", workerType: "FT", templateManaged: true }),
        expect.objectContaining({ area: "VIDEO", workerType: "ST", templateManaged: true }),
      ],
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "shift_group_created" }),
    });
  });
});
