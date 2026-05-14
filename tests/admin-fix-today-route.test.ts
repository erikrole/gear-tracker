import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/admin-fix-today", () => ({
  getAdminFixTodayQueue: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { getAdminFixTodayQueue } from "@/lib/admin-fix-today";
import { GET } from "@/app/api/admin/fix-today/route";

const noParams = { params: Promise.resolve({}) };

const adminUser = {
  id: "admin-1",
  email: "admin@test.com",
  name: "Admin",
  role: "ADMIN" as const,
  avatarUrl: null,
};

const staffUser = {
  id: "staff-1",
  email: "staff@test.com",
  name: "Staff",
  role: "STAFF" as const,
  avatarUrl: null,
};

function makeGetRequest() {
  return new Request("https://app.example.com/api/admin/fix-today", {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/fix-today", () => {
  it("returns the fix-today queue for ADMIN", async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminUser);
    vi.mocked(getAdminFixTodayQueue).mockResolvedValue({
      generatedAt: "2026-05-13T12:00:00.000Z",
      totals: {
        openItems: 0,
        activeChecks: 7,
        checksNeedingWork: 0,
        criticalChecks: 0,
      },
      sections: [],
      partialFailures: [],
    });

    const res = await GET(makeGetRequest(), noParams);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: {
        generatedAt: "2026-05-13T12:00:00.000Z",
        totals: {
          openItems: 0,
          activeChecks: 7,
          checksNeedingWork: 0,
          criticalChecks: 0,
        },
        sections: [],
        partialFailures: [],
      },
    });
  });

  it("returns 403 and does not load queue data for STAFF", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);

    const res = await GET(makeGetRequest(), noParams);

    expect(res.status).toBe(403);
    expect(getAdminFixTodayQueue).not.toHaveBeenCalled();
  });
});
