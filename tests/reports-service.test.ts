import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingStatus } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    booking: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { getCheckoutReport, getOverdueReport } from "@/lib/services/reports";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-10T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("reports service", () => {
  it("excludes draft bookings from checkout activity analytics", async () => {
    vi.mocked(db.booking.count)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2);
    vi.mocked(db.booking.findMany).mockResolvedValue([]);
    vi.mocked(db.booking.groupBy).mockResolvedValue([]);
    vi.mocked(db.$queryRaw).mockResolvedValue([]);
    vi.mocked(db.user.findMany).mockResolvedValue([]);

    const report = await getCheckoutReport(30);

    expect(report.totalCheckouts).toBe(7);
    expect(db.booking.count).toHaveBeenNthCalledWith(1, {
      where: expect.objectContaining({
        kind: "CHECKOUT",
        status: { not: BookingStatus.DRAFT },
        createdAt: { gte: expect.any(Date) },
      }),
    });
    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: BookingStatus.DRAFT } }),
      }),
    );
    expect(db.booking.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: BookingStatus.DRAFT } }),
      }),
    );
    const rawSql = vi.mocked(db.$queryRaw).mock.calls[0]?.[0] as unknown;
    const rawSqlText = Array.isArray(rawSql) ? rawSql.join("") : String(rawSql);
    expect(rawSqlText).toContain('"status" <> \'DRAFT\'');
  });

  it("counts only outstanding gear in the overdue report", async () => {
    vi.mocked(db.booking.findMany).mockResolvedValue([
      {
        id: "booking-1",
        title: "Camera checkout",
        endsAt: new Date("2026-05-10T09:00:00.000Z"),
        requester: { id: "user-1", name: "Alex Student" },
        location: { id: "loc-1", name: "Main" },
        serializedItems: [
          { asset: { id: "asset-1", assetTag: "CAM-1", name: "Camera" } },
        ],
        bulkItems: [
          {
            checkedOutQuantity: 5,
            checkedInQuantity: 2,
            plannedQuantity: 5,
            bulkSku: { id: "sku-1", name: "AA Batteries" },
          },
          {
            checkedOutQuantity: 2,
            checkedInQuantity: 2,
            plannedQuantity: 2,
            bulkSku: { id: "sku-2", name: "SD Cards" },
          },
        ],
      },
    ] as any);

    const report = await getOverdueReport();
    const requester = report.leaderboard[0];
    expect(requester).toBeDefined();
    const booking = requester!.bookings[0];
    expect(booking).toBeDefined();

    expect(db.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          serializedItems: expect.objectContaining({
            where: { allocationStatus: "active" },
          }),
        }),
      }),
    );
    expect(booking!.itemCount).toBe(4);
    expect(booking!.items).toEqual(["CAM-1", "AA Batteries x3"]);
  });
});
