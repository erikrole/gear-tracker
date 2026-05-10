import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { badges } from "@/lib/badges";

describe("badge flag-off query guard", () => {
  const originalFlag = process.env.BADGES_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BADGES_ENABLED = originalFlag;
  });

  it("performs no badge transaction work while disabled", async () => {
    process.env.BADGES_ENABLED = "false";

    await Promise.all([
      badges.onCheckoutOpened({
        userId: "user-1",
        bookingId: "booking-1",
        source: "kiosk_checkout",
        sourceKey: "booking-1",
      }),
      badges.onCheckoutReturned({
        userId: "user-1",
        bookingId: "booking-1",
        completedAt: new Date("2026-05-09T18:00:00.000Z"),
        wasOnTime: true,
        sourceKey: "booking-1",
      }),
      badges.onScanResult({
        userId: "user-1",
        bookingId: "booking-1",
        phase: "pickup",
        ok: true,
        sourceKey: "scan-1",
      }),
      badges.onTradeCompleted({
        userId: "user-1",
        tradeId: "trade-1",
        sourceKey: "trade-1",
      }),
    ]);

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
