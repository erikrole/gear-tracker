import { beforeEach, describe, expect, it, vi } from "vitest";

const { start, update } = vi.hoisted(() => ({ start: vi.fn(), update: vi.fn() }));

vi.mock("workflow/api", () => ({ start }));
vi.mock("@/lib/db", () => ({ db: { shiftGroup: { update } } }));
vi.mock("@/workflows/schedule-notification-flush", () => ({
  scheduleNotificationFlushWorkflow: vi.fn(),
}));

import {
  SCHEDULE_NOTIFY_DELAY_MS,
  scheduleNotificationFlush,
} from "@/lib/schedule-notification-debounce";

const NOW = new Date("2026-10-15T12:00:00.000Z");

describe("scheduleNotificationFlush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue({});
    start.mockResolvedValue({ runId: "run-1" });
  });

  it("pushes the flush out by the quiet period and clears any prior error", async () => {
    const result = await scheduleNotificationFlush({ shiftGroupId: "group-1", now: NOW });

    expect(SCHEDULE_NOTIFY_DELAY_MS).toBe(600_000);
    expect(result.at).toEqual(new Date("2026-10-15T12:10:00.000Z"));
    expect(update).toHaveBeenCalledWith({
      where: { id: "group-1" },
      data: { notifyAfter: new Date("2026-10-15T12:10:00.000Z"), notifyError: null },
    });
    expect(start).toHaveBeenCalledWith(expect.any(Function), [
      "group-1",
      "2026-10-15T12:10:00.000Z",
    ]);
  });

  it("keeps the edit when the timer cannot start, since the change is already live", async () => {
    start.mockRejectedValueOnce(new Error("workflow unavailable"));

    await expect(scheduleNotificationFlush({ shiftGroupId: "group-1", now: NOW }))
      .resolves.toMatchObject({ at: new Date("2026-10-15T12:10:00.000Z") });

    // notify_after is still recorded, so the sweeper can deliver it later.
    expect(update).toHaveBeenCalled();
  });

  it("accepts a shorter window for callers that need one", async () => {
    const result = await scheduleNotificationFlush({
      shiftGroupId: "group-1",
      now: NOW,
      delayMs: 60_000,
    });
    expect(result.at).toEqual(new Date("2026-10-15T12:01:00.000Z"));
  });
});
