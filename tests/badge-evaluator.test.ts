import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadgeStreakType } from "@prisma/client";

const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    booking: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    badgeDefinition: {
      findMany: vi.fn(),
    },
    studentBadge: {
      createMany: vi.fn(),
    },
    badgeStreak: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    _mockTx: mockTx,
  },
}));

import { onCheckoutOpened, onCheckoutReturned, onScanResult } from "@/lib/badges/evaluator";

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.studentBadge.createMany.mockResolvedValue({ count: 0 });
  mockTx.badgeStreak.upsert.mockResolvedValue({});
});

describe("badge evaluator checkout events", () => {
  it("awards checkout threshold badges from opened checkout count", async () => {
    mockTx.booking.count.mockResolvedValue(5);
    mockTx.badgeDefinition.findMany.mockResolvedValue([
      { id: "first-checkout" },
      { id: "checkout-5" },
    ]);

    await onCheckoutOpened({
      userId: "user-1",
      bookingId: "booking-1",
      source: "kiosk_checkout",
      sourceKey: "booking-1",
    });

    expect(mockTx.booking.count).toHaveBeenCalledWith({
      where: {
        requesterUserId: "user-1",
        kind: "CHECKOUT",
        status: { in: ["OPEN", "COMPLETED"] },
      },
    });
    expect(mockTx.studentBadge.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", definitionId: "first-checkout" },
        { userId: "user-1", definitionId: "checkout-5" },
      ],
      skipDuplicates: true,
    });
  });

  it("awards on-time count and streak badges once per source key", async () => {
    const now = new Date("2026-05-09T18:00:00.000Z");
    mockTx.booking.findMany.mockResolvedValue([
      { endsAt: new Date("2026-05-09T17:50:00.000Z"), updatedAt: now },
      { endsAt: new Date("2026-05-08T18:00:00.000Z"), updatedAt: new Date("2026-05-08T18:20:00.000Z") },
    ]);
    mockTx.badgeDefinition.findMany
      .mockResolvedValueOnce([{ id: "on-time-1" }])
      .mockResolvedValueOnce([{ id: "streak-5" }]);
    mockTx.badgeStreak.findUnique.mockResolvedValue({
      current: 4,
      longest: 4,
      lastSourceKey: "older-booking",
    });

    await onCheckoutReturned({
      userId: "user-1",
      bookingId: "booking-1",
      completedAt: now,
      wasOnTime: true,
      sourceKey: "booking-1",
    });

    expect(mockTx.badgeStreak.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_streakType: {
            userId: "user-1",
            streakType: BadgeStreakType.ON_TIME_RETURN,
          },
        },
        update: expect.objectContaining({
          current: 5,
          longest: 5,
          lastSourceKey: "booking-1",
        }),
      }),
    );
    expect(mockTx.studentBadge.createMany).toHaveBeenCalledTimes(2);
  });

  it("does not increment the on-time streak twice for the same source key", async () => {
    mockTx.booking.findMany.mockResolvedValue([
      {
        endsAt: new Date("2026-05-09T18:00:00.000Z"),
        updatedAt: new Date("2026-05-09T18:01:00.000Z"),
      },
    ]);
    mockTx.badgeDefinition.findMany.mockResolvedValueOnce([{ id: "on-time-1" }]);
    mockTx.badgeStreak.findUnique.mockResolvedValue({
      current: 1,
      longest: 1,
      lastSourceKey: "booking-1",
    });

    await onCheckoutReturned({
      userId: "user-1",
      bookingId: "booking-1",
      completedAt: new Date("2026-05-09T18:01:00.000Z"),
      wasOnTime: true,
      sourceKey: "booking-1",
    });

    expect(mockTx.badgeStreak.upsert).not.toHaveBeenCalled();
    expect(mockTx.badgeDefinition.findMany).toHaveBeenCalledTimes(1);
  });

  it("resets the on-time streak on a late return", async () => {
    mockTx.badgeStreak.findUnique.mockResolvedValue({
      current: 3,
      longest: 4,
      lastSourceKey: "older-booking",
    });

    await onCheckoutReturned({
      userId: "user-1",
      bookingId: "booking-1",
      completedAt: new Date("2026-05-09T19:00:00.000Z"),
      wasOnTime: false,
      sourceKey: "booking-1",
    });

    expect(mockTx.badgeStreak.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          current: 0,
          lastSourceKey: "booking-1",
        }),
      }),
    );
    expect(mockTx.studentBadge.createMany).not.toHaveBeenCalled();
  });

  it("awards scan count and clean-scan rule badges on successful scans", async () => {
    mockTx.badgeStreak.findUnique
      .mockResolvedValueOnce({
        current: 24,
        longest: 24,
        lastSourceKey: "older-scan",
      })
      .mockResolvedValueOnce({
        current: 9,
        longest: 9,
        lastSourceKey: "older-scan",
      });
    mockTx.badgeDefinition.findMany
      .mockResolvedValueOnce([{ id: "scan-25" }])
      .mockResolvedValueOnce([{ id: "zero-errors" }]);

    await onScanResult({
      userId: "user-1",
      bookingId: "booking-1",
      phase: "pickup",
      ok: true,
      sourceKey: "scan-event-1",
    });

    expect(mockTx.badgeStreak.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_streakType: {
            userId: "user-1",
            streakType: BadgeStreakType.SCAN_SUCCESS_COUNT,
          },
        },
        update: expect.objectContaining({
          current: 25,
          longest: 25,
          lastSourceKey: "scan-event-1",
        }),
      }),
    );
    expect(mockTx.badgeStreak.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_streakType: {
            userId: "user-1",
            streakType: BadgeStreakType.SCAN_CLEAN,
          },
        },
        update: expect.objectContaining({
          current: 10,
          longest: 10,
          lastSourceKey: "scan-event-1",
        }),
      }),
    );
    expect(mockTx.studentBadge.createMany).toHaveBeenCalledTimes(2);
  });

  it("resets the clean-scan streak on failed scans", async () => {
    mockTx.badgeStreak.findUnique.mockResolvedValue({
      current: 4,
      longest: 8,
      lastSourceKey: "older-scan",
    });

    await onScanResult({
      userId: "user-1",
      bookingId: "booking-1",
      phase: "checkin",
      ok: false,
      errorCode: "not_in_booking",
      sourceKey: "checkin:booking-1:bad:not_in_booking",
    });

    expect(mockTx.badgeStreak.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_streakType: {
            userId: "user-1",
            streakType: BadgeStreakType.SCAN_CLEAN,
          },
        },
        update: expect.objectContaining({
          current: 0,
          lastSourceKey: "checkin:booking-1:bad:not_in_booking",
        }),
      }),
    );
    expect(mockTx.studentBadge.createMany).not.toHaveBeenCalled();
  });
});
