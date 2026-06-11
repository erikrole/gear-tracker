import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      findMany: vi.fn(),
    },
    shiftAssignment: {
      findMany: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { GET as getAudit } from "@/app/api/audit/route";
import { GET as getMyShifts } from "@/app/api/my-shifts/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin One",
  role: "ADMIN" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};

const studentUser = {
  id: "student-1",
  email: "student@example.com",
  name: "Student One",
  role: "STUDENT" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};

function request(path: string) {
  return new Request(`https://app.example.com${path}`, {
    headers: { host: "app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enforceRateLimit).mockResolvedValue(undefined);
  vi.mocked(db.auditLog.findMany).mockResolvedValue([]);
  vi.mocked(db.shiftAssignment.findMany).mockResolvedValue([]);
  vi.mocked(db.booking.findMany).mockResolvedValue([]);
});

describe("custom API limit parsing", () => {
  it.each([
    ["missing", "/api/audit", 51],
    ["zero", "/api/audit?limit=0", 51],
    ["negative", "/api/audit?limit=-1", 51],
    ["over max", "/api/audit?limit=999", 101],
  ])("normalizes audit limit for %s input", async (_label, path, expectedTake) => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);

    const res = await getAudit(request(path), { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: expectedTake }),
    );
  });

  it.each([
    ["missing", "/api/my-shifts", 5],
    ["zero", "/api/my-shifts?limit=0", 5],
    ["negative", "/api/my-shifts?limit=-1", 5],
    ["over max", "/api/my-shifts?limit=999", 20],
  ])("normalizes my-shifts limit for %s input", async (_label, path, expectedTake) => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await getMyShifts(request(path), { params: Promise.resolve({}) });

    expect(res.status).toBe(200);
    expect(db.shiftAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: expectedTake }),
    );
  });
});
