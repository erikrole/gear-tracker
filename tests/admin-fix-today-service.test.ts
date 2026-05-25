import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    booking: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    kioskDevice: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    asset: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    bulkSku: {
      findMany: vi.fn(),
    },
    calendarSource: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    licenseCode: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { getAdminFixTodayQueue } from "@/lib/admin-fix-today";

const mockedDb = db as unknown as {
  booking: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  kioskDevice: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  asset: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  bulkSku: { findMany: ReturnType<typeof vi.fn> };
  calendarSource: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  licenseCode: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminFixTodayQueue", () => {
  it("formats sample detail dates for operators instead of leaking ISO timestamps", async () => {
    mockedDb.booking.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    mockedDb.booking.findMany
      .mockResolvedValueOnce([
        {
          id: "checkout-1",
          title: "Overdue checkout",
          refNumber: "CO-100",
          endsAt: new Date("2026-05-25T14:30:00.000Z"),
          requester: { name: "Erik Role" },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "pickup-1",
          title: "Pending pickup",
          refNumber: "CO-101",
          startsAt: new Date("2026-05-26T15:00:00.000Z"),
          requester: { name: "Creative Admin" },
        },
      ]);
    mockedDb.kioskDevice.count.mockResolvedValueOnce(1);
    mockedDb.kioskDevice.findMany.mockResolvedValueOnce([
      {
        id: "kiosk-1",
        name: "Erik's iPad",
        lastSeenAt: new Date("2026-05-11T19:19:38.368Z"),
        location: { name: "Camp Randall" },
      },
    ]);
    mockedDb.asset.count.mockResolvedValueOnce(0);
    mockedDb.asset.findMany.mockResolvedValueOnce([]);
    mockedDb.bulkSku.findMany.mockResolvedValueOnce([]);
    mockedDb.calendarSource.count.mockResolvedValueOnce(0);
    mockedDb.calendarSource.findMany.mockResolvedValueOnce([]);
    mockedDb.licenseCode.count.mockResolvedValueOnce(1);
    mockedDb.licenseCode.findMany.mockResolvedValueOnce([
      {
        id: "license-1",
        label: "Photo Mechanic",
        accountEmail: null,
        expiresAt: new Date("2026-06-01T18:00:00.000Z"),
        status: "AVAILABLE",
        claimedBy: null,
      },
    ]);

    const queue = await getAdminFixTodayQueue(new Date("2026-05-25T16:00:00.000Z"));
    const details = queue.sections.flatMap((section) => section.samples.map((sample) => sample.detail));
    const overdueSection = queue.sections.find((section) => section.key === "overdue-checkouts");

    expect(details.join("\n")).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(details).toContain("Erik Role / due May 25, 2026, 9:30 AM");
    expect(details).toContain("Creative Admin / pickup May 26, 2026, 10:00 AM");
    expect(details).toContain("Camp Randall / last seen May 11, 2026, 2:19 PM");
    expect(details).toContain("available / unassigned / expires Jun 1, 2026, 1:00 PM");
    expect(overdueSection?.href).toBe("/bookings?tab=checkouts&filter=overdue");
  });
});
