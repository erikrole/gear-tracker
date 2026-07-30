import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    calendarEvent: {
      findUnique: vi.fn(),
    },
    eventTravelMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/calendar-events/[id]/travel/route";
import { DELETE } from "@/app/api/calendar-events/[id]/travel/[memberId]/route";

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

function calendarEvent(row: unknown) {
  return row as Awaited<ReturnType<typeof db.calendarEvent.findUnique>>;
}

function travelMembers(rows: unknown) {
  return rows as Awaited<ReturnType<typeof db.eventTravelMember.findMany>>;
}

function makeGetRequest() {
  return new Request("https://app.example.com/api/calendar-events/event-1/travel", {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

// The add-member schema requires a cuid, so this has to be a well-formed one
// or validation rejects the body before any route logic runs.
const TARGET_USER_ID = "ckt1a2b3c4d5e6f7g8h9i0jkl";

function makePostRequest() {
  return new Request("https://app.example.com/api/calendar-events/event-1/travel", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify({ userId: TARGET_USER_ID }),
  });
}

function makeMalformedPostRequest() {
  return new Request("https://app.example.com/api/calendar-events/event-1/travel", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: "{not-json",
  });
}

function makeDeleteRequest() {
  return new Request("https://app.example.com/api/calendar-events/event-1/travel/member-1", {
    method: "DELETE",
    headers: {
      host: "app.example.com",
      origin: "https://app.example.com",
    },
  });
}

describe("calendar event travel authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows STUDENT to read event travel rosters", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue(calendarEvent({ id: "event-1" }));
    vi.mocked(db.eventTravelMember.findMany).mockResolvedValue(travelMembers([
      {
        id: "member-2",
        eventId: "event-1",
        userId: "student-2",
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: {
          id: "student-2",
          name: "Teammate",
          role: Role.STUDENT,
          primaryArea: null,
          avatarUrl: null,
        },
      },
    ]));

    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it("allows STAFF to read event travel rosters for an existing event", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue(calendarEvent({ id: "event-1" }));
    vi.mocked(db.eventTravelMember.findMany).mockResolvedValue(travelMembers([
      {
        id: "member-1",
        eventId: "event-1",
        userId: "user-target",
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: {
          id: "user-target",
          name: "Traveler",
          role: Role.STUDENT,
          primaryArea: null,
          avatarUrl: null,
        },
      },
    ]));

    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it("returns 404 before listing members when the event does not exist", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue(null);

    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(404);
    expect(db.eventTravelMember.findMany).not.toHaveBeenCalled();
  });

  it("blocks STUDENT from adding event travel members", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await POST(makePostRequest(), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(403);
    expect(db.eventTravelMember.create).not.toHaveBeenCalled();
  });

  it("rejects malformed add-member JSON before creating travel members", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue(calendarEvent({ id: "event-1" }));

    const res = await POST(makeMalformedPostRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
    expect(db.eventTravelMember.create).not.toHaveBeenCalled();
  });

  it("adds a traveler and records an audit entry", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue(
      calendarEvent({ id: "event-1", summary: "Wisconsin at Iowa" }),
    );
    vi.mocked(db.user.findFirst).mockResolvedValue(
      { id: TARGET_USER_ID, name: "Traveler" } as never,
    );
    vi.mocked(db.eventTravelMember.create).mockResolvedValue({
      id: "member-1",
      notes: null,
    } as never);

    const res = await POST(makePostRequest(), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(201);
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "calendar_event",
          entityId: "event-1",
          action: "event_travel_member_added",
        }),
      }),
    );
  });

  // REGRESSION: an unknown or deactivated id used to reach Postgres as a
  // foreign-key violation, which has no central mapping and surfaced as a 500.
  it("returns 404 for an unknown or inactive traveler instead of a foreign-key 500", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue(calendarEvent({ id: "event-1" }));
    vi.mocked(db.user.findFirst).mockResolvedValue(null as never);

    const res = await POST(makePostRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("That person is not an active user");
    expect(db.eventTravelMember.create).not.toHaveBeenCalled();
  });

  it("turns a duplicate-roster constraint violation into a named 409", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue(calendarEvent({ id: "event-1" }));
    vi.mocked(db.user.findFirst).mockResolvedValue(
      { id: TARGET_USER_ID, name: "Traveler" } as never,
    );
    vi.mocked(db.eventTravelMember.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const res = await POST(makePostRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Traveler is already on the travel roster");
  });

  it("records an audit entry when a traveler is removed", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.eventTravelMember.findUnique).mockResolvedValue({
      eventId: "event-1",
      userId: TARGET_USER_ID,
      notes: "driving",
      user: { name: "Traveler" },
    } as never);
    vi.mocked(db.eventTravelMember.delete).mockResolvedValue({} as never);

    const res = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ id: "event-1", memberId: "member-1" }),
    });

    expect(res.status).toBe(200);
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "calendar_event",
          entityId: "event-1",
          action: "event_travel_member_removed",
          beforeJson: expect.objectContaining({ userName: "Traveler", notes: "driving" }),
        }),
      }),
    );
  });

  it("blocks STUDENT from deleting event travel members", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ id: "event-1", memberId: "member-1" }),
    });

    expect(res.status).toBe(403);
    expect(db.eventTravelMember.delete).not.toHaveBeenCalled();
  });
});
