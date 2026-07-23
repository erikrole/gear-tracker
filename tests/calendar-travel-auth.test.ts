import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, Role } from "@prisma/client";

declare global {
  var __calendarTravelTransactionOptions: unknown;
}

const mockTx = {
  calendarEvent: {
    findUnique: vi.fn(),
  },
  studentSportAssignment: {
    findUnique: vi.fn(),
  },
  eventTravelMember: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>, options?: unknown) => {
      globalThis.__calendarTravelTransactionOptions = options;
      return fn(mockTx);
    }),
    calendarEvent: {
      findUnique: vi.fn(),
    },
    eventTravelMember: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
  SETTINGS_MUTATION_LIMIT: { max: 60, windowMs: 60_000 },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { GET, POST } from "@/app/api/calendar-events/[id]/travel/route";
import { DELETE } from "@/app/api/calendar-events/[id]/travel/[memberId]/route";

const targetUserId = "cm111111111111111111111111";

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

function makePostRequest() {
  return new Request("https://app.example.com/api/calendar-events/event-1/travel", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify({ userId: targetUserId }),
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

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__calendarTravelTransactionOptions = undefined;
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
  vi.mocked(enforceRateLimit).mockResolvedValue(undefined);
  mockTx.calendarEvent.findUnique.mockResolvedValue({ id: "event-1", sportCode: "FB" });
  mockTx.studentSportAssignment.findUnique.mockResolvedValue({
    id: "sport-assignment-1",
    user: { active: true },
  });
  mockTx.eventTravelMember.create.mockResolvedValue({
    id: "member-1",
    eventId: "event-1",
    userId: targetUserId,
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    user: {
      id: targetUserId,
      name: "Traveler",
      role: Role.STUDENT,
      primaryArea: null,
      avatarUrl: null,
    },
  });
  mockTx.eventTravelMember.findUnique.mockResolvedValue({
    eventId: "event-1",
    userId: targetUserId,
    notes: null,
  });
  mockTx.eventTravelMember.delete.mockResolvedValue({ id: "member-1" });
  mockTx.auditLog.create.mockResolvedValue({ id: "audit-1" });
});

describe("calendar event travel authorization", () => {
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
    expect(mockTx.eventTravelMember.create).not.toHaveBeenCalled();
  });

  it("rejects malformed add-member JSON before creating travel members", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    const res = await POST(makeMalformedPostRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
    expect(mockTx.eventTravelMember.create).not.toHaveBeenCalled();
  });

  it("atomically adds active sport-roster travelers with audit evidence", async () => {
    const res = await POST(makePostRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.id).toBe("member-1");
    expect(enforceRateLimit).toHaveBeenCalledWith(
      "event-travel:write:staff-1",
      { max: 60, windowMs: 60_000 },
    );
    expect(mockTx.studentSportAssignment.findUnique).toHaveBeenCalledWith({
      where: {
        userId_sportCode: {
          userId: targetUserId,
          sportCode: "FB",
        },
      },
      select: {
        id: true,
        user: { select: { active: true } },
      },
    });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "staff-1",
        entityType: "calendar_event",
        entityId: "event-1",
        action: "travel_member_added",
        afterJson: expect.objectContaining({
          travelMemberId: "member-1",
          userId: targetUserId,
          sportCode: "FB",
          _actorRole: Role.STAFF,
        }),
      }),
    });
    expect(globalThis.__calendarTravelTransactionOptions).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("rejects travelers outside the event's active sport roster", async () => {
    mockTx.studentSportAssignment.findUnique.mockResolvedValue(null);

    const res = await POST(makePostRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Traveler must be an active member of this event's sport roster");
    expect(mockTx.eventTravelMember.create).not.toHaveBeenCalled();
    expect(mockTx.auditLog.create).not.toHaveBeenCalled();
  });

  it("returns an actionable conflict when the database rejects a duplicate traveler", async () => {
    vi.mocked(db.$transaction).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const res = await POST(makePostRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("This person is already on the travel roster");
  });

  it("blocks STUDENT from deleting event travel members", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ id: "event-1", memberId: "member-1" }),
    });

    expect(res.status).toBe(403);
    expect(mockTx.eventTravelMember.delete).not.toHaveBeenCalled();
  });

  it("atomically removes the event's travel member with a before snapshot", async () => {
    const res = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ id: "event-1", memberId: "member-1" }),
    });

    expect(res.status).toBe(200);
    expect(mockTx.eventTravelMember.delete).toHaveBeenCalledWith({
      where: { id: "member-1" },
    });
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "staff-1",
        entityType: "calendar_event",
        entityId: "event-1",
        action: "travel_member_removed",
        beforeJson: {
          travelMemberId: "member-1",
          userId: targetUserId,
          notes: null,
        },
        afterJson: expect.objectContaining({
          travelMemberId: "member-1",
          userId: targetUserId,
          removed: true,
          _actorRole: Role.STAFF,
        }),
      }),
    });
    expect(globalThis.__calendarTravelTransactionOptions).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
});
