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
          shift: {
            startsAt: { gte: expect.any(Date), lte: expect.any(Date) },
            // Cancelled/archived events must drop out of the feed — that's
            // how subscribed calendar apps remove them.
            shiftGroup: { event: { status: "CONFIRMED", archivedAt: null } },
          },
        }),
        include: expect.objectContaining({
          shift: expect.objectContaining({
            include: expect.objectContaining({
              shiftGroup: expect.objectContaining({
                include: expect.objectContaining({
                  event: expect.objectContaining({
                    select: expect.objectContaining({
                      id: true,
                      summary: true,
                      // Venue for the LOCATION line; the sportCode/opponent/
                      // isHome fields are no longer selected since the title is
                      // now the plain summary, not a derived "code vs opp".
                      rawLocationText: true,
                      location: { select: { name: true } },
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
    // Straight event title from the source summary: the "Wisconsin Athletics"
    // prefix is stripped, and no area/trade decoration is added.
    expect(body).toContain("SUMMARY:Men's Basketball vs Iowa");
    expect(body).not.toContain("Photo:");
    expect(body).not.toContain("MBB vs");
    // Full call window resolved as a coherent pair. The assignment here has a
    // personal call *start* but no end, so it falls through to the shift's own
    // window (15:00-17:00) rather than splicing 14:30 onto the shift end.
    expect(body).toContain("DTSTART:20260510T150000Z");
    expect(body).toContain("DTEND:20260510T170000Z");
    expect(body).toContain("LOCATION:Camp Randall");
    // Canonical app origin (env.appUrl), never the request's Host header —
    // a spoofed Host must not seed links into a subscribed calendar.
    expect(body).toContain("URL:http://localhost:3000/events/event-1");
    expect(body).not.toContain("URL:https://app.example.com");
    expect(body).toContain("LAST-MODIFIED:20260501T140000Z");
    expect(body).toContain("SEQUENCE:");
    expect(body).toContain("TRANSP:OPAQUE");
    expect(body).not.toContain("DESCRIPTION:");
    // Refresh hints, both spellings: Apple honors REFRESH-INTERVAL, older
    // clients read only X-PUBLISHED-TTL. Without them a subscribed calendar
    // can sit a day stale, which is useless for same-day shift trades.
    expect(body).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT1H");
    expect(body).toContain("X-PUBLISHED-TTL:PT1H");
  });

  it("locates away games from raw source text when there is no linked venue", async () => {
    vi.mocked(db.shiftAssignment.findMany).mockResolvedValueOnce(shiftAssignments([
      {
        id: "assignment-1",
        callStartsAt: new Date("2026-05-10T15:00:00.000Z"),
        callEndsAt: new Date("2026-05-10T18:00:00.000Z"),
        updatedAt: new Date("2026-05-01T12:00:00.000Z"),
        shift: {
          startsAt: new Date("2026-05-10T16:00:00.000Z"),
          endsAt: new Date("2026-05-10T18:00:00.000Z"),
          callStartsAt: null,
          callEndsAt: null,
          area: "PHOTO",
          notes: null,
          updatedAt: new Date("2026-05-01T13:00:00.000Z"),
          shiftGroup: {
            event: {
              id: "event-9",
              summary: "[L] Wisconsin Badgers Softball at UCLA",
              rawLocationText: "Los Angeles, CA",
              updatedAt: new Date("2026-05-01T14:00:00.000Z"),
              location: null,
            },
          },
        },
        trades: [],
      },
    ]));

    const res = await GET(request(), { params: Promise.resolve({ token: validToken }) });
    const body = await res.text();

    // Result marker and "Wisconsin Badgers" prefix stripped from the title.
    expect(body).toContain("SUMMARY:Softball at UCLA");
    // No linked Location, so the raw source text fills the venue.
    expect(body).toContain("LOCATION:Los Angeles\\, CA");
    // A complete personal call window is used verbatim.
    expect(body).toContain("DTSTART:20260510T150000Z");
    expect(body).toContain("DTEND:20260510T180000Z");
  });

  it("folds long content lines per RFC 5545 without splitting multi-byte characters", async () => {
    const longOpponent = "Extremely Long Opponent Name University of the Upper Midwest Conference Champions";
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
              summary: `Wisconsin Athletics Men's Basketball vs ${longOpponent}`,
              sportCode: "MBB",
              opponent: longOpponent,
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

    const encoder = new TextEncoder();
    for (const line of body.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // Folded lines reassemble to the original content (unfold then check)
    const unfolded = body.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:Men's Basketball vs ${longOpponent}`);
  });

  it("keeps the title plain but re-publishes when a trade posts", async () => {
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

    // Trade status no longer decorates the title — the calendar entry is the
    // straight event name whether or not the shift is posted for trade.
    expect(body).toContain("SUMMARY:Men's Basketball vs Iowa");
    expect(body).not.toContain("🔁");
    // But the trade's updatedAt still drives LAST-MODIFIED, so posting a shift
    // for trade re-publishes the event and subscribers re-sync it.
    expect(body).toContain("LAST-MODIFIED:20260502T120000Z");
  });
});
