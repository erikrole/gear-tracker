import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarEventStatus, Role } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(dbMock)),
  calendarEvent: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
  createAuditEntryTx: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntry, createAuditEntryTx } from "@/lib/audit";
import { db } from "@/lib/db";
import { PATCH } from "@/app/api/calendar-events/[id]/route";
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

function patch(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/calendar-events/cmevent000000000000000001", {
    method: "PATCH",
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
  vi.mocked(createAuditEntryTx).mockResolvedValue(undefined);
  vi.mocked(db.calendarEvent.findUnique).mockResolvedValue({
    id: "cmevent000000000000000001",
    summary: "Football vs Notre Dame",
    subtitle: null,
    isHome: true,
    locationId: null,
    rawSummary: "Football vs Notre Dame",
    rawLocationText: "Green Bay, Wis., Lambeau Field",
    opponent: "Notre Dame",
    summaryLocked: false,
    isHomeLocked: false,
    locationLocked: false,
  } as Awaited<ReturnType<typeof db.calendarEvent.findUnique>>);
  vi.mocked(db.calendarEvent.update).mockResolvedValue({
    id: "cmevent000000000000000001",
    summary: "Football vs Notre Dame",
    subtitle: null,
    isHome: null,
    locationId: null,
    opponent: null,
    summaryLocked: false,
    isHomeLocked: true,
    locationLocked: false,
    location: null,
  } as unknown as Awaited<ReturnType<typeof db.calendarEvent.update>>);
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

describe("PATCH /api/calendar-events/[id]", () => {
  it("lets staff save a game as a locked non-game event by clearing opponent", async () => {
    const res = await PATCH(
      patch({
        isHome: null,
        opponent: null,
      }),
      { params: Promise.resolve({ id: "cmevent000000000000000001" }) },
    );

    expect(res.status).toBe(200);
    expect(db.calendarEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isHome: null,
          opponent: null,
          isHomeLocked: true,
        }),
      }),
    );
    expect(createAuditEntryTx).toHaveBeenCalledOnce();
  });
});
