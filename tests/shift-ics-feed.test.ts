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

function request() {
  return new Request(`https://app.example.com/api/shifts/ics/${validToken}`, {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getClientIp).mockReturnValue("203.0.113.10");
  vi.mocked(checkRateLimit).mockReturnValue({
    allowed: true,
    remaining: 10,
    resetAt: Date.now() + 60_000,
  });
  vi.mocked(db.user.findFirst).mockResolvedValue({
    id: "user-1",
    name: "Student One",
  } as any);
  vi.mocked(db.shiftAssignment.findMany).mockResolvedValue([
    {
      id: "assignment-1",
      shift: {
        startsAt: new Date("2026-05-10T15:00:00.000Z"),
        endsAt: new Date("2026-05-10T17:00:00.000Z"),
        area: "PHOTO",
        notes: "Bring camera, vest",
        shiftGroup: {
          event: {
            summary: "Wisconsin vs Iowa",
            locationId: "loc-1",
            location: { name: "Camp Randall" },
          },
        },
      },
    },
  ] as any);
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
      .mockReturnValueOnce({ allowed: true, remaining: 0, resetAt: Date.now() + 30_000 })
      .mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

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
    expect(body).toContain("SUMMARY:Wisconsin vs Iowa (PHOTO)");
    expect(body).toContain("LOCATION:Camp Randall");
    expect(body).toContain("DESCRIPTION:Bring camera\\, vest");
  });
});
