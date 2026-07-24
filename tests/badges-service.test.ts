import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/badges/evaluator", () => ({
  onCheckoutOpened: vi.fn(async () => {
    throw new Error("checkout evaluator should not run");
  }),
  onCheckoutReturned: vi.fn(async () => {
    throw new Error("return evaluator should not run");
  }),
  onScanResult: vi.fn(async () => {
    throw new Error("scan evaluator should not run");
  }),
  onTradeCompleted: vi.fn(async () => {
    throw new Error("trade evaluator should not run");
  }),
  onShiftsWorked: vi.fn(async () => {
    throw new Error("shift evaluator should not run");
  }),
}));

vi.mock("@/lib/observability", () => ({
  captureBadgeError: vi.fn(),
}));

import { badges, badgesEnabled } from "@/lib/badges";
import * as evaluator from "@/lib/badges/evaluator";
import { captureBadgeError } from "@/lib/observability";

describe("badge service feature flag", () => {
  const originalFlag = process.env.BADGES_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BADGES_ENABLED = originalFlag;
  });

  it("returns before evaluator work when BADGES_ENABLED is not true", async () => {
    process.env.BADGES_ENABLED = "false";

    await badges.onCheckoutOpened({
      userId: "user-1",
      bookingId: "booking-1",
      source: "kiosk_checkout",
      sourceKey: "booking-1",
    });

    expect(badgesEnabled()).toBe(false);
    expect(evaluator.onCheckoutOpened).not.toHaveBeenCalled();
    expect(captureBadgeError).not.toHaveBeenCalled();
  });

  it("throws evaluator errors in test and development", async () => {
    process.env.BADGES_ENABLED = "true";

    await expect(
      badges.onCheckoutOpened({
        userId: "user-1",
        bookingId: "booking-1",
        source: "kiosk_checkout",
        sourceKey: "booking-1",
      }),
    ).rejects.toThrow("checkout evaluator should not run");

    expect(evaluator.onCheckoutOpened).toHaveBeenCalledTimes(1);
    expect(captureBadgeError).not.toHaveBeenCalled();
  });
});
