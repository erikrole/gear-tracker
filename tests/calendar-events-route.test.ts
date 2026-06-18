import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarEventStatus, Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    calendarEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { POST } from "@/app/api/calendar-events/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

function post(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/calendar-events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
  vi.mocked(db.calendarEvent.create).mockResolvedValue({
    id: "cmevent000000000000000001",
    sourceId: null,
    externalId: "manual-event-1",
    summary: "Manual smoke event",
    description: null,
    rawSummary: null,
    rawLocationText: null,
    rawDescription: null,
    startsAt: new Date("2026-05-12T14:00:00.000Z"),
    endsAt: new Date("2026-05-12T16:00:00.000Z"),
    allDay: false,
    status: CalendarEventStatus.CONFIRMED,
    locationId: null,
    sportCode: null,
    isHome: null,
    isHidden: false,
    summaryLocked: false,
    isHomeLocked: false,
    locationLocked: false,
    archivedAt: null,
    subtitle: null,
    opponent: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    location: null,
  } as Awaited<ReturnType<typeof db.calendarEvent.create>>);
  vi.mocked(createAuditEntry).mockResolvedValue(undefined);
});

describe("POST /api/calendar-events", () => {
  it("creates manual events without a calendar source", async () => {
    const res = await POST(
      post({
        summary: "Manual smoke event",
        startsAt: "2026-05-12T14:00:00.000Z",
        endsAt: "2026-05-12T16:00:00.000Z",
        allDay: false,
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(201);
    expect(db.calendarEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceId: null,
          summary: "Manual smoke event",
        }),
      }),
    );
    expect(createAuditEntry).toHaveBeenCalledOnce();
  });

  it("persists a manual multi-day all-day event with canonical UTC-midnight date bounds", async () => {
    await POST(
      post({
        summary: "Football Media Day Shoot",
        startsAt: "2026-07-07T07:00:00.000Z",
        endsAt: "2026-07-09T07:00:00.000Z",
        allDay: true,
      }),
      { params: Promise.resolve({}) },
    );

    expect(db.calendarEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceId: null,
          summary: "Football Media Day Shoot",
          startsAt: new Date("2026-07-07T00:00:00.000Z"),
          endsAt: new Date("2026-07-09T00:00:00.000Z"),
          allDay: true,
        }),
      }),
    );
  });
});
