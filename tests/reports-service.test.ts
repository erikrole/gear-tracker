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
    bulkSkuUnit: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    bulkSku: {
      findMany: vi.fn(),
    },
    bookingBulkUnitAllocation: {
      findMany: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { getBulkLossReport, getCheckoutReport, getOverdueReport } from "@/lib/services/reports";

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

  it("adds numbered battery audit details to the bulk loss report", async () => {
    vi.mocked(db.bulkSkuUnit.groupBy).mockResolvedValue([
      { bulkSkuId: "battery-sku-1", _count: { id: 2 } },
    ] as any);
    vi.mocked(db.bulkSkuUnit.findMany).mockResolvedValue([
      {
        id: "unit-1",
        unitNumber: 1,
        notes: "Missing after event",
        updatedAt: new Date("2026-05-09T12:00:00.000Z"),
        bulkSku: { id: "battery-sku-1", name: "Sony NP-FZ100 Battery" },
        allocations: [
          {
            bookingBulkItem: {
              booking: {
                id: "booking-1",
                refNumber: "CO-1001",
                title: "Softball",
                requester: { id: "user-1", name: "Alex Student" },
              },
            },
          },
        ],
      },
      {
        id: "unit-2",
        unitNumber: 2,
        notes: null,
        updatedAt: new Date("2026-05-10T12:00:00.000Z"),
        bulkSku: { id: "battery-sku-1", name: "Sony NP-FZ100 Battery" },
        allocations: [
          {
            bookingBulkItem: {
              booking: {
                id: "booking-2",
                refNumber: "CO-1002",
                title: "Baseball",
                requester: { id: "user-1", name: "Alex Student" },
              },
            },
          },
        ],
      },
    ] as any);
    vi.mocked(db.auditLog.findMany).mockResolvedValue([]);
    vi.mocked(db.bulkSku.findMany)
      .mockResolvedValueOnce([
        {
          id: "battery-sku-1",
          name: "Sony NP-FZ100 Battery",
          category: "Batteries",
          categoryRel: { name: "Camera Batteries" },
          location: { id: "loc-1", name: "Main Cage" },
          units: [
            {
              id: "unit-1",
              unitNumber: 1,
              status: "LOST",
              notes: "Missing after event",
              updatedAt: new Date("2026-05-09T12:00:00.000Z"),
              allocations: [
                {
                  checkedOutAt: new Date("2026-05-01T12:00:00.000Z"),
                  checkedInAt: null,
                  createdAt: new Date("2026-05-01T12:00:00.000Z"),
                  bookingBulkItem: {
                    booking: {
                      id: "booking-1",
                      refNumber: "CO-1001",
                      title: "Softball",
                      requester: { id: "user-1", name: "Alex Student" },
                    },
                  },
                },
              ],
            },
            {
              id: "unit-2",
              unitNumber: 2,
              status: "LOST",
              notes: null,
              updatedAt: new Date("2026-05-10T12:00:00.000Z"),
              allocations: [
                {
                  checkedOutAt: new Date("2026-05-02T12:00:00.000Z"),
                  checkedInAt: null,
                  createdAt: new Date("2026-05-02T12:00:00.000Z"),
                  bookingBulkItem: {
                    booking: {
                      id: "booking-2",
                      refNumber: "CO-1002",
                      title: "Baseball",
                      requester: { id: "user-1", name: "Alex Student" },
                    },
                  },
                },
              ],
            },
            {
              id: "unit-3",
              unitNumber: 3,
              status: "AVAILABLE",
              notes: null,
              updatedAt: new Date("2026-05-03T12:00:00.000Z"),
              allocations: [],
            },
            {
              id: "unit-4",
              unitNumber: 4,
              status: "CHECKED_OUT",
              notes: null,
              updatedAt: new Date("2026-05-04T12:00:00.000Z"),
              allocations: [],
            },
          ],
        },
        {
          id: "media-sku-1",
          name: "CFexpress Cards",
          category: "Media",
          categoryRel: { name: "Media" },
          location: { id: "loc-1", name: "Main Cage" },
          units: [
            {
              id: "media-unit-1",
              unitNumber: 1,
              status: "LOST",
              notes: null,
              updatedAt: new Date("2026-05-10T12:00:00.000Z"),
              allocations: [],
            },
          ],
        },
      ] as any)
      .mockResolvedValueOnce([
        { id: "battery-sku-1", name: "Sony NP-FZ100 Battery" },
      ] as any);
    vi.mocked(db.bookingBulkUnitAllocation.findMany).mockResolvedValue([
      {
        id: "alloc-1",
        checkedOutAt: new Date("2026-05-02T12:00:00.000Z"),
        checkedInAt: new Date("2026-05-04T12:00:00.000Z"),
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        bulkSkuUnit: {
          id: "unit-2",
          unitNumber: 2,
          status: "LOST",
          bulkSku: {
            id: "battery-sku-1",
            name: "Sony NP-FZ100 Battery",
            category: "Batteries",
            categoryRel: { name: "Camera Batteries" },
          },
        },
        bookingBulkItem: {
          booking: {
            id: "booking-2",
            refNumber: "CO-1002",
            title: "Baseball",
            requester: { id: "user-1", name: "Alex Student" },
          },
        },
      },
      {
        id: "alloc-media",
        checkedOutAt: new Date("2026-05-02T12:00:00.000Z"),
        checkedInAt: null,
        createdAt: new Date("2026-05-02T12:00:00.000Z"),
        bulkSkuUnit: {
          id: "media-unit-1",
          unitNumber: 1,
          status: "LOST",
          bulkSku: {
            id: "media-sku-1",
            name: "CFexpress Cards",
            category: "Media",
            categoryRel: { name: "Media" },
          },
        },
        bookingBulkItem: {
          booking: {
            id: "booking-media",
            refNumber: "CO-2001",
            title: "Media",
            requester: { id: "user-2", name: "Sam Student" },
          },
        },
      },
    ] as any);

    const report = await getBulkLossReport();

    expect(report.batteryAudit.totals).toMatchObject({
      skuCount: 1,
      totalUnits: 4,
      lost: 2,
      available: 1,
      checkedOut: 1,
      repeatPatternCount: 2,
    });
    expect(report.batteryAudit.totals.lossRate).toBe(0.5);
    expect(report.batteryAudit.bySku[0]).toMatchObject({
      bulkSkuId: "battery-sku-1",
      lost: 2,
      lossRate: 0.5,
      missingUnitNumbers: [1, 2],
    });
    expect(report.batteryAudit.missingUnits.map((unit) => unit.unitNumber)).toEqual([2, 1]);
    expect(report.batteryAudit.repeatPatterns.map((pattern) => pattern.type)).toEqual(["requester", "sku"]);
    expect(report.batteryAudit.checkoutHistory).toHaveLength(1);
    expect(report.batteryAudit.checkoutHistory[0]).toMatchObject({
      id: "alloc-1",
      skuName: "Sony NP-FZ100 Battery",
      durationDays: 2,
    });
  });
});
