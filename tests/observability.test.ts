import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { captureBadgeError } from "@/lib/observability";

describe("captureBadgeError", () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENTRY_DSN = originalDsn;
  });

  it("logs without sending to Sentry when SENTRY_DSN is absent", () => {
    process.env.SENTRY_DSN = "";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    captureBadgeError(new Error("boom"), { evaluator: "onScanResult" });

    expect(spy).toHaveBeenCalledWith("event=badge_evaluator_failed", {
      evaluator: "onScanResult",
      error: "boom",
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it("sends badge evaluator failures to Sentry when SENTRY_DSN is configured", () => {
    process.env.SENTRY_DSN = "https://example@sentry.invalid/1";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("boom");

    captureBadgeError(error, { evaluator: "onTradeCompleted" });

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { area: "badges" },
      extra: { evaluator: "onTradeCompleted" },
    });

    spy.mockRestore();
  });
});
