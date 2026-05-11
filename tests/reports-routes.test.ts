import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/reports", () => ({
  getScanHistoryReport: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { getScanHistoryReport } from "@/lib/services/reports";
import { GET as getScanReport } from "@/app/api/reports/scans/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: "STAFF" as any,
  avatarUrl: null,
};

function authedGet(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
  vi.mocked(getScanHistoryReport).mockResolvedValue({
    data: [],
    total: 0,
    successCount: 0,
    successRate: 0,
    dailyScans: [],
    limit: 50,
    offset: 0,
  } as never);
});

describe("reports routes", () => {
  it("rejects invalid scan phases before calling the report service", async () => {
    const res = await getScanReport(
      authedGet("/api/reports/scans?phase=RETURN"),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid phase");
    expect(getScanHistoryReport).not.toHaveBeenCalled();
  });

  it("rejects invalid scan report dates before calling the report service", async () => {
    const res = await getScanReport(
      authedGet("/api/reports/scans?startDate=not-a-date"),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid startDate");
    expect(getScanHistoryReport).not.toHaveBeenCalled();
  });

  it("passes validated scan filters to the report service", async () => {
    const res = await getScanReport(
      authedGet("/api/reports/scans?limit=25&offset=50&phase=CHECKIN&startDate=2026-05-01T00:00:00.000Z&endDate=2026-05-10T00:00:00.000Z"),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(getScanHistoryReport).toHaveBeenCalledWith(
      25,
      50,
      "2026-05-01T00:00:00.000Z",
      "2026-05-10T00:00:00.000Z",
      "CHECKIN",
    );
  });
});
