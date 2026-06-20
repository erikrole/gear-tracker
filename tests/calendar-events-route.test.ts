import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarEventStatus, Role } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(dbMock)),
  calendarEvent: {
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  shiftGroup: {
    findMany: vi.fn(),
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
import { GET, POST } from "@/app/api/calendar-events/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

const studentUser = {
  id: "student-1",
  email: "student@example.com",
  name: "Student One",
  role: Role.STUDENT,
  avatarUrl: null,
};

function get(path = "/api/calendar-events") {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: {
      host: "app.example.com",
    },
  });
}

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

function malformedPost() {
  return new Request("https://app.example.com/api/calendar-events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: "{not-json",
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
  vi.mocked(db.calendarEvent.findMany).mockResolvedValue([]);
  vi.mocked(db.calendarEvent.count).mockResolvedValue(0);
  vi.mocked(db.shiftGroup.findMany).mockResolvedValue([]);
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

describe("GET /api/calendar-events", () => {
  it("excludes hidden and archived events by default", async () => {
    const res = await GET(
      get("/api/calendar-events?startDate=2026-07-08T00:00:00.000Z&endDate=2026-07-08T23:59:59.999Z"),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(db.calendarEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isHidden: false,
          archivedAt: null,
          startsAt: { lte: new Date("2026-07-08T23:59:59.999Z") },
          endsAt: { gt: new Date("2026-07-08T00:00:00.000Z") },
        }),
      }),
    );
  });

  it("lets staff include hidden and archived events explicitly", async () => {
    const res = await GET(
      get("/api/calendar-events?includeHidden=true&includeArchived=true&includePast=true"),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    const findArgs = vi.mocked(db.calendarEvent.findMany).mock.calls[0]?.[0];
    expect(findArgs?.where).not.toHaveProperty("isHidden");
    expect(findArgs?.where).not.toHaveProperty("archivedAt");
  });

  it("denies students from including hidden events", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await GET(
      get("/api/calendar-events?includeHidden=true"),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(403);
    expect(db.calendarEvent.findMany).not.toHaveBeenCalled();
  });

  it("normalizes sportCode query filters before querying", async () => {
    const res = await GET(
      get("/api/calendar-events?sportCode=vb"),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(db.calendarEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sportCode: "VB",
        }),
      }),
    );
  });

  it("rejects unknown sportCode query filters", async () => {
    const res = await GET(
      get("/api/calendar-events?sportCode=football"),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(400);
    expect(db.calendarEvent.findMany).not.toHaveBeenCalled();
  });
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

  it("normalizes manual event sportCode before persistence", async () => {
    const res = await POST(
      post({
        summary: "Volleyball vs Kentucky",
        startsAt: "2026-08-21T20:00:00.000Z",
        endsAt: "2026-08-21T22:00:00.000Z",
        sportCode: "vb",
        isHome: null,
        opponent: "Kentucky",
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(201);
    expect(db.calendarEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sportCode: "VB",
          isHome: null,
          opponent: "Kentucky",
        }),
      }),
    );
  });

  it("trims manual event fields before persistence", async () => {
    const res = await POST(
      post({
        summary: "  Volleyball vs Louisville  ",
        startsAt: "2026-08-22T20:00:00.000Z",
        endsAt: "2026-08-22T22:00:00.000Z",
        locationId: "cm000000000000000000000100",
        sportCode: " vb ",
        isHome: null,
        opponent: "  Louisville  ",
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(201);
    expect(db.calendarEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          summary: "Volleyball vs Louisville",
          locationId: "cm000000000000000000000100",
          sportCode: "VB",
          opponent: "Louisville",
        }),
      }),
    );
  });

  it("normalizes manual event opponent before persistence", async () => {
    const res = await POST(
      post({
        summary: "Volleyball vs Louisville",
        startsAt: "2026-08-22T20:00:00.000Z",
        endsAt: "2026-08-22T22:00:00.000Z",
        sportCode: "VB",
        isHome: null,
        opponent: "  No. 7 University of Louisville  ",
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(201);
    expect(db.calendarEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          opponent: "Louisville",
        }),
      }),
    );
  });

  it("clears event type and opponent when no sport is selected", async () => {
    const res = await POST(
      post({
        summary: "Media day",
        startsAt: "2026-08-22T20:00:00.000Z",
        endsAt: "2026-08-22T22:00:00.000Z",
        sportCode: null,
        isHome: true,
        opponent: "Iowa",
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(201);
    expect(db.calendarEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sportCode: null,
          isHome: null,
          opponent: null,
        }),
      }),
    );
  });

  it("rejects unknown manual event sportCode values", async () => {
    const res = await POST(
      post({
        summary: "Football vs Notre Dame",
        startsAt: "2026-09-06T23:30:00.000Z",
        endsAt: "2026-09-07T02:30:00.000Z",
        sportCode: "football",
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(400);
    expect(db.calendarEvent.create).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before creating a manual event", async () => {
    const res = await POST(malformedPost(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
    expect(db.calendarEvent.create).not.toHaveBeenCalled();
  });

  it("rejects blank manual event titles before creating", async () => {
    const res = await POST(
      post({
        summary: "   ",
        startsAt: "2026-08-22T20:00:00.000Z",
        endsAt: "2026-08-22T22:00:00.000Z",
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(400);
    expect(db.calendarEvent.create).not.toHaveBeenCalled();
  });

  it("rejects invalid manual event dates before creating", async () => {
    const res = await POST(
      post({
        summary: "Bad date event",
        startsAt: "not-a-date",
        endsAt: "2026-08-22T22:00:00.000Z",
      }),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid date");
    expect(db.calendarEvent.create).not.toHaveBeenCalled();
  });

  it("rejects inverted manual event date ranges before creating", async () => {
    const res = await POST(
      post({
        summary: "Backwards event",
        startsAt: "2026-08-22T22:00:00.000Z",
        endsAt: "2026-08-22T20:00:00.000Z",
      }),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("End must be after start");
    expect(db.calendarEvent.create).not.toHaveBeenCalled();
  });

  it("rejects invalid manual event location ids before creating", async () => {
    const res = await POST(
      post({
        summary: "Bad location event",
        startsAt: "2026-08-22T20:00:00.000Z",
        endsAt: "2026-08-22T22:00:00.000Z",
        locationId: "loc-1",
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(400);
    expect(db.calendarEvent.create).not.toHaveBeenCalled();
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

  it("normalizes saved opponent edits", async () => {
    const res = await PATCH(
      patch({
        opponent: "  #12 University of Illinois  ",
      }),
      { params: Promise.resolve({ id: "cmevent000000000000000001" }) },
    );

    expect(res.status).toBe(200);
    expect(db.calendarEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          opponent: "Illinois",
          isHomeLocked: true,
        }),
      }),
    );
  });
});
