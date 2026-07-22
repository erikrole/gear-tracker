import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadgeStreakType, Prisma } from "@prisma/client";

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
    shiftTrade: {
      count: vi.fn(),
    },
    shiftAssignment: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
    _mockTx: mockTx,
  },
}));

import { db } from "@/lib/db";
import { onCheckoutOpened, onCheckoutReturned, onScanResult, onShiftsWorked, onTradeCompleted } from "@/lib/badges/evaluator";

const dbMock = db as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.studentBadge.createMany.mockResolvedValue({ count: 0 });
  mockTx.badgeStreak.upsert.mockResolvedValue({});
  mockTx.booking.findMany.mockResolvedValue([]);
});

describe("badge evaluator shift work", () => {
  it("awards shift badges from assignments to events that have ended", async () => {
    mockTx.shiftAssignment.count.mockResolvedValue(10);
    mockTx.badgeDefinition.findMany.mockResolvedValue([{ id: "first-shift" }, { id: "shift-10" }]);

    await onShiftsWorked({ userId: "user-1" });

    expect(mockTx.badgeDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          category: "SHIFT",
          trigger: "shift:completed",
          threshold: { not: null, lte: 10 },
        }),
      }),
    );
    expect(mockTx.studentBadge.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "user-1", definitionId: "first-shift" },
        { userId: "user-1", definitionId: "shift-10" },
      ],
      skipDuplicates: true,
    });
  });

  it("counts archived events too", async () => {
    // `morning-refresh` stamps archivedAt on events older than four months as
    // list hygiene. Excluding them would make a worked-shift total fall over
    // time and strand someone below a threshold they had already passed.
    mockTx.shiftAssignment.count.mockResolvedValue(3);
    mockTx.badgeDefinition.findMany.mockResolvedValue([]);

    await onShiftsWorked({ userId: "user-1" });

    const where = mockTx.shiftAssignment.count.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain("archivedAt");
  });

  it("is safe to re-run nightly forever", async () => {
    // There is no sourceKey to dedupe on. Idempotency comes from counting the
    // database and writing with skipDuplicates, so a second pass over the same
    // shifts asks for exactly the same rows and changes nothing.
    mockTx.shiftAssignment.count.mockResolvedValue(10);
    mockTx.badgeDefinition.findMany.mockResolvedValue([{ id: "first-shift" }, { id: "shift-10" }]);

    await onShiftsWorked({ userId: "user-1" });
    await onShiftsWorked({ userId: "user-1" });

    const [first, second] = mockTx.studentBadge.createMany.mock.calls;
    expect(second).toEqual(first);
    expect(first[0].skipDuplicates).toBe(true);
  });
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
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("awards on-time count and streak badges once per source key", async () => {
    const now = new Date("2026-05-09T18:00:00.000Z");
    mockTx.booking.findMany.mockResolvedValue([
      { endsAt: new Date("2026-05-09T17:50:00.000Z"), updatedAt: now, completedAt: now },
      {
        endsAt: new Date("2026-05-08T18:00:00.000Z"),
        updatedAt: new Date("2026-05-08T18:20:00.000Z"),
        completedAt: new Date("2026-05-08T18:20:00.000Z"),
      },
    ]);
    // Keyed off the query rather than call order: `onCheckoutReturned` now runs
    // three award lanes -- on-time count, damage-free count, and the streak --
    // and an ordered mock queue silently mis-assigns them.
    mockTx.badgeDefinition.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.ruleKey === "on_time_return") return [{ id: "on-time-1" }];
      if (where.ruleKey === "on_time_return_streak") return [{ id: "streak-5" }];
      return [];
    });
    mockTx.booking.count.mockResolvedValue(0);
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
    // The on-time badge and the streak badge, each written once.
    const written = mockTx.studentBadge.createMany.mock.calls.flatMap(
      (call: [{ data: Array<{ definitionId: string }> }]) => call[0].data.map((row) => row.definitionId),
    );
    expect(written).toEqual(["on-time-1", "streak-5"]);
  });

  it("does not increment the on-time streak twice for the same source key", async () => {
    mockTx.booking.findMany.mockResolvedValue([
      {
        endsAt: new Date("2026-05-09T18:00:00.000Z"),
        updatedAt: new Date("2026-05-09T18:01:00.000Z"),
        completedAt: new Date("2026-05-09T18:01:00.000Z"),
      },
    ]);
    mockTx.badgeDefinition.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => (
      where.ruleKey === "on_time_return" ? [{ id: "on-time-1" }] : []
    ));
    mockTx.booking.count.mockResolvedValue(0);
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
    // No streak lane ran, so no streak badge was ever looked up.
    const ruleKeys = mockTx.badgeDefinition.findMany.mock.calls.map(
      (call: [{ where: { ruleKey?: string } }]) => call[0].where.ruleKey,
    );
    expect(ruleKeys).not.toContain("on_time_return_streak");
  });

  it("counts on-time returns from completedAt even when later edits move updatedAt", async () => {
    mockTx.booking.findMany.mockResolvedValue([
      {
        endsAt: new Date("2026-05-09T18:00:00.000Z"),
        completedAt: new Date("2026-05-09T18:05:00.000Z"),
        updatedAt: new Date("2026-05-10T12:00:00.000Z"),
      },
      {
        endsAt: new Date("2026-05-08T18:00:00.000Z"),
        completedAt: null,
        updatedAt: new Date("2026-05-08T18:05:00.000Z"),
      },
    ]);
    mockTx.badgeDefinition.findMany
      .mockImplementationOnce(async ({ where }) => {
        expect(where.threshold?.lte).toBe(2);
        return [{ id: "on-time-2" }];
      })
      .mockResolvedValueOnce([]);
    mockTx.badgeStreak.findUnique.mockResolvedValue(null);

    await onCheckoutReturned({
      userId: "user-1",
      bookingId: "booking-1",
      completedAt: new Date("2026-05-09T18:05:00.000Z"),
      wasOnTime: true,
      sourceKey: "booking-1",
    });

    expect(mockTx.booking.findMany).toHaveBeenCalledWith({
      where: {
        requesterUserId: "user-1",
        kind: "CHECKOUT",
        status: "COMPLETED",
      },
      select: { endsAt: true, updatedAt: true, completedAt: true },
    });
    expect(mockTx.studentBadge.createMany).toHaveBeenCalledWith({
      data: [{ userId: "user-1", definitionId: "on-time-2" }],
      skipDuplicates: true,
    });
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

  it("awards trade threshold badges from completed trade count", async () => {
    mockTx.shiftTrade.count.mockResolvedValue(10);
    mockTx.badgeDefinition.findMany.mockResolvedValue([{ id: "trade-10" }]);

    await onTradeCompleted({
      userId: "user-1",
      tradeId: "trade-1",
      sourceKey: "trade-1",
    });

    expect(mockTx.shiftTrade.count).toHaveBeenCalledWith({
      where: {
        status: "COMPLETED",
        OR: [
          { postedByUserId: "user-1" },
          { claimedByUserId: "user-1" },
        ],
      },
    });
    expect(mockTx.studentBadge.createMany).toHaveBeenCalledWith({
      data: [{ userId: "user-1", definitionId: "trade-10" }],
      skipDuplicates: true,
    });
  });

  it("retries serializable conflicts and no-ops duplicate scan source keys", async () => {
    dbMock.$transaction
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Serializable conflict", {
          code: "P2034",
          clientVersion: "test",
        }),
      )
      .mockImplementationOnce(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx));
    mockTx.badgeStreak.findUnique
      .mockResolvedValueOnce({
        current: 1,
        longest: 1,
        lastSourceKey: "scan-event-1",
      })
      .mockResolvedValueOnce({
        current: 1,
        longest: 1,
        lastSourceKey: "scan-event-1",
      });

    await onScanResult({
      userId: "user-1",
      bookingId: "booking-1",
      phase: "pickup",
      ok: true,
      sourceKey: "scan-event-1",
    });

    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(mockTx.badgeStreak.upsert).not.toHaveBeenCalled();
    expect(mockTx.studentBadge.createMany).not.toHaveBeenCalled();
  });
});
