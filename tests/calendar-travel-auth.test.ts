import { describe, expect, it, vi } from "vitest";

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
  role: "STAFF" as const,
  avatarUrl: null,
};

const studentUser = {
  id: "student-1",
  email: "student@test.com",
  name: "Student",
  role: "STUDENT" as const,
  avatarUrl: null,
};

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
    body: JSON.stringify({ userId: "user-target" }),
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
  it("allows STUDENT to read event travel rosters", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue({ id: "event-1" } as any);
    vi.mocked(db.eventTravelMember.findMany).mockResolvedValue([
      {
        id: "member-2",
        eventId: "event-1",
        userId: "student-2",
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: {
          id: "student-2",
          name: "Teammate",
          role: "STUDENT",
          primaryArea: null,
          avatarUrl: null,
        },
      },
    ] as any);

    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: "event-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it("allows STAFF to read event travel rosters for an existing event", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(db.calendarEvent.findUnique).mockResolvedValue({ id: "event-1" } as any);
    vi.mocked(db.eventTravelMember.findMany).mockResolvedValue([
      {
        id: "member-1",
        eventId: "event-1",
        userId: "user-target",
        notes: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: {
          id: "user-target",
          name: "Traveler",
          role: "STUDENT",
          primaryArea: null,
          avatarUrl: null,
        },
      },
    ] as any);

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

  it("blocks STUDENT from deleting event travel members", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ id: "event-1", memberId: "member-1" }),
    });

    expect(res.status).toBe(403);
    expect(db.eventTravelMember.delete).not.toHaveBeenCalled();
  });
});
