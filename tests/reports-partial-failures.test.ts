import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  asset: {
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  booking: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  location: { findMany: vi.fn() },
  department: { findMany: vi.fn() },
  category: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));

const statusMock = vi.hoisted(() => ({
  countAssetsByEffectiveStatus: vi.fn(),
  deriveAssetStatusesFromLoaded: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/services/status", () => statusMock);

import { getCheckoutReport, getUtilizationReport } from "@/lib/services/reports";

describe("report partial-failure truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps successful utilization sections and names every unavailable section", async () => {
    statusMock.countAssetsByEffectiveStatus.mockResolvedValue({
      AVAILABLE: 5,
      CHECKED_OUT: 1,
      PENDING_PICKUP: 0,
      RESERVED: 0,
      MAINTENANCE: 0,
      RETIRED: 1,
    });
    dbMock.asset.count
      .mockRejectedValueOnce(new Error("asset total unavailable"))
      .mockResolvedValueOnce(6);
    dbMock.asset.groupBy
      .mockResolvedValueOnce([{ locationId: "loc-1", _count: 6 }])
      .mockResolvedValueOnce([{ type: "CAMERA", _count: 4 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    dbMock.location.findMany.mockResolvedValue([{ id: "loc-1", name: "Camp Randall" }]);
    dbMock.$queryRaw
      .mockResolvedValueOnce([{ custody_days: 8, assets_used: 3, checkout_count: 4 }])
      .mockRejectedValueOnce(new Error("ranking unavailable"))
      .mockResolvedValueOnce([{
        idle_count: 3,
        idle_priced_count: 2,
        idle_value: 500,
        never_count: 1,
      }])
      .mockResolvedValueOnce([]);

    const report = await getUtilizationReport(30);

    expect(report.statusCounts.AVAILABLE).toBe(5);
    expect(report.totalAssets).toBe(0);
    expect(report.activeAssets).toBe(6);
    expect(report.byLocation).toEqual([
      { location: "Camp Randall", locationId: "loc-1", count: 6 },
    ]);
    expect(report.custody).toMatchObject({
      assetsUsed: 3,
      custodyDays: 8,
      idleCount: 3,
      topUsed: [],
    });
    expect(report.partialFailures).toEqual(["asset total", "most-used gear"]);
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it("keeps checkout activity when overdue and requester-name queries fail", async () => {
    dbMock.booking.count
      .mockResolvedValueOnce(12)
      .mockRejectedValueOnce(new Error("overdue unavailable"));
    dbMock.booking.findMany.mockResolvedValue([]);
    dbMock.booking.groupBy.mockResolvedValue([{ requesterUserId: "user-1", _count: 4 }]);
    dbMock.$queryRaw.mockResolvedValue([
      { date: new Date().toISOString().slice(0, 10), count: 3n },
    ]);
    dbMock.user.findMany.mockRejectedValue(new Error("users unavailable"));

    const report = await getCheckoutReport(30);

    expect(report.totalCheckouts).toBe(12);
    expect(report.overdueCheckouts).toBe(0);
    expect(report.topRequesters).toEqual([{ name: "Unknown", count: 4 }]);
    expect(report.dailyTrend.length).toBeGreaterThan(0);
    expect(report.partialFailures).toEqual(["overdue total", "requester names"]);
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
