import { beforeEach, describe, expect, it, vi } from "vitest";

const { start } = vi.hoisted(() => ({ start: vi.fn() }));

vi.mock("workflow/api", () => ({ start }));
vi.mock("@/workflows/pending-schedule-release", () => ({ pendingScheduleReleaseWorkflow: vi.fn() }));

import { enqueuePendingScheduleRelease, SCHEDULE_RELEASE_DELAY_MS } from "@/lib/schedule-auto-release";

describe("schedule automatic release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    start.mockResolvedValue({ runId: "run-10" });
  });

  it("starts an exact-version workflow ten minutes after the edit", async () => {
    const now = new Date("2026-08-07T12:00:00.000Z");
    const result = await enqueuePendingScheduleRelease({ shiftGroupId: "group-1", version: 8, now });

    expect(SCHEDULE_RELEASE_DELAY_MS).toBe(600_000);
    expect(result).toEqual({ at: new Date("2026-08-07T12:10:00.000Z"), runId: "run-10" });
    expect(start).toHaveBeenCalledWith(expect.any(Function), [
      "group-1",
      8,
      "2026-08-07T12:10:00.000Z",
    ]);
  });

  it("rejects the edit when the durable timer cannot start", async () => {
    start.mockRejectedValueOnce(new Error("workflow unavailable"));
    await expect(enqueuePendingScheduleRelease({ shiftGroupId: "group-1", version: 3 }))
      .rejects.toMatchObject({ status: 503 });
  });
});
