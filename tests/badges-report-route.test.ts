import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/reports", () => ({
  getBadgeReport: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { getBadgeReport } from "@/lib/services/reports";
import { GET } from "@/app/api/reports/badges/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff",
  role: "STAFF" as const,
  avatarUrl: null,
};

const studentUser = {
  id: "student-1",
  email: "student@example.com",
  name: "Student",
  role: "STUDENT" as const,
  avatarUrl: null,
};

function makeGetRequest() {
  return new Request("https://app.example.com/api/reports/badges", {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/reports/badges", () => {
  it("returns badge analytics for staff", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(getBadgeReport).mockResolvedValue({
      totalAwards: 2,
      manualAwards: 1,
      automaticAwards: 1,
      manualAwardRate: 0.5,
      recentAwardCount: 2,
      activeDefinitionCount: 20,
      leaderboard: [],
      distribution: [],
      underusedDefinitions: [],
      recentAwards: [],
    });

    const res = await GET(makeGetRequest(), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalAwards).toBe(2);
    expect(getBadgeReport).toHaveBeenCalledTimes(1);
  });

  it("blocks students before report work", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await GET(makeGetRequest(), { params: Promise.resolve({}) });

    expect(res.status).toBe(403);
    expect(getBadgeReport).not.toHaveBeenCalled();
  });
});
