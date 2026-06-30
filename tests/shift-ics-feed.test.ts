import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findFirst: vi.fn(),
    },
    shiftAssignment: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

import { GET } from "@/app/api/shifts/ics/[token]/route";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const validToken = "a".repeat(48);

function user(row: unknown) {
  return row as Awaited<ReturnType<typeof db.user.findFirst>>;
}

function shiftAssignments(rows: unknown) {
  return rows as Awaited<ReturnType<typeof db.shiftAssignment.findMany>>;
}

function request() {
  return new Request(`https://app.example.com/api/shifts/ics/${validToken}`, {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getClientIp).mockReturnValue("203.0.113.10");
  vi.mocked(checkRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 10,
    resetAt: Date.now() + 60_000,
  });
  vi.mocked(db.user.findFirst).mockResolvedValue(user({
    id: "user-1",
    name: "Student One",
  }));
  vi.mocked(db.shiftAssignment.findMany).mockResolvedValue(shiftAssignments([
    {
      id: "assignment-1",
      callStartsAt: new Date("2026-05-10T14:30:00.000Z"),
      callEndsAt: null,
      updatedAt: new Date("2026-05-01T12:00:00.000Z"),
      shift: {
        startsAt: new Date("2026-05-10T15:00:00.000Z"),
        endsAt: new Date("2026-05-10T17:00:00.000Z"),
        callStartsAt: null,
        callEndsAt: null,
        area: "PHOTO",
        notes: "Bring camera, vest",
        updatedAt: new Date("2026-05-01T13:00:00.000Z"),
        shiftGroup: {
          event: {
            id: "event-1",
            summary: "Wisconsin Athletics Men's Basketball vs Iowa",
            sportCode: "MBB",
            opponent: "Iowa",
            isHome: true,
            locationId: "loc-1",
            updatedAt: new Date("2026-05-01T14:00:00.000Z"),
            location: { name: "Camp Randall" },
          },
        },
      },
      trades: [],
    },
  ]));
});

describe("shift ICS feed hardening", () => {
  it("returns 404 for malformed tokens without querying users", async () => {
    const res = await GET(request(), { params: Promise.resolve({ token: "bad-token" }) });

    expect(res.status).toBe(404);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("rate limits by client IP and token before querying the feed", async () => {
    vi.mocked(checkRateLimit)
      .mockResolvedValueOnce({ allowed: true, remaining: 0, resetAt: Date.now() + 30_000 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const res = await GET(request(), { params: Promise.resolve({ token: validToken }) });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(checkRateLimit).toHaveBeenCalledWith("shifts:ics:ip:203.0.113.10", { max: 120, windowMs: 60_000 });
    expect(checkRateLimit).toHaveBeenCalledWith(`shifts:ics:token:${validToken}`, { max: 30, windowMs: 60_000 });
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("only serves active users and caps the shift assignment query", async () => {
    const res = await GET(request(), { params: Promise.resolve({ token: validToken }) });

    expect(res.status).toBe(200);
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: { icsToken: validToken, active: true },
    });
    expect(db.shiftAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: { in: ["DIRECT_ASSIGNED", "APPROVED"] },
          shift: { startsAt: { gte: expect.any(Date), lte: expect.any(Date) } },
        }),
        include: expect.objectContaining({
          shift: expect.objectContaining({
            include: expect.objectContaining({
              shiftGroup: expect.objectContaining({
                include: expect.objectContaining({
                  event: expect.objectContaining({
                    select: expect.objectContaining({
                      id: true,
                      sportCode: true,
                      opponent: true,
                      isHome: true,
                    }),
                  }),
                }),
              }),
            }),
          }),
          trades: expect.objectContaining({
            where: { status: { in: ["OPEN", "CLAIMED"] } },
          }),
        }),
        take: 500,
      }),
    );
    expect(res.headers.get("X-Event-Limit")).toBe("500");
  });

  it("renders a bounded ICS calendar response", async () => {
    const res = await GET(request(), { params: Promise.resolve({ token: validToken }) });
    const body = await res.text();

    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("SUMMARY:Photo: MBB vs Iowa");
    expect(body).toContain("DTSTART:20260510T143000Z");
    expect(body).toContain("DTEND:20260510T170000Z");
    expect(body).toContain("LOCATION:Camp Randall");
    expect(body).toContain("URL:https://app.example.com/events/event-1");
    expect(body).toContain("LAST-MODIFIED:20260501T140000Z");
    expect(body).toContain("SEQUENCE:");
    expect(body).toContain("TRANSP:OPAQUE");
    expect(body).not.toContain("DESCRIPTION:");
  });

  it("marks active trade-board posts in the shift title", async () => {
    vi.mocked(db.shiftAssignment.findMany).mockResolvedValueOnce(shiftAssignments([
      {
        id: "assignment-1",
        callStartsAt: null,
        callEndsAt: null,
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        shift: {
          startsAt: new Date("2026-05-10T15:00:00.000Z"),
          endsAt: new Date("2026-05-10T17:00:00.000Z"),
          callStartsAt: null,
          callEndsAt: null,
          area: "PHOTO",
          notes: null,
          updatedAt: new Date("2026-05-01T13:00:00.000Z"),
          shiftGroup: {
            event: {
              id: "event-1",
              summary: "Wisconsin Athletics Men's Basketball vs Iowa",
              sportCode: "MBB",
              opponent: "Iowa",
              isHome: true,
              locationId: "loc-1",
              updatedAt: new Date("2026-05-01T14:00:00.000Z"),
              location: { name: "Camp Randall" },
            },
          },
        },
        trades: [{ id: "trade-1", status: "OPEN", updatedAt: new Date("2026-05-02T12:00:00.000Z") }],
      },
    ]));

    const res = await GET(request(), { params: Promise.resolve({ token: validToken }) });
    const body = await res.text();

    expect(body).toContain("SUMMARY:🔁 Photo: MBB vs Iowa");
    expect(body).toContain("LAST-MODIFIED:20260502T120000Z");
  });
});
