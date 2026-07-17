import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
}));

vi.mock("workflow/api", () => ({ start: mocks.start }));

import { scheduleShiftTimeChangedNotifications } from "@/lib/shift-notification-workflow";
import { shiftTimeChangedNotificationsWorkflow } from "@/workflows/shift-time-changed-notifications";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.start.mockResolvedValue({ runId: "run-1" });
});

describe("scheduleShiftTimeChangedNotifications", () => {
  it("does not create an empty workflow run", async () => {
    await expect(scheduleShiftTimeChangedNotifications([])).resolves.toBeNull();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("schedules the complete assignment fanout as one durable run", async () => {
    await expect(scheduleShiftTimeChangedNotifications([
      "assignment-1",
      "assignment-2",
    ])).resolves.toBe("run-1");

    expect(mocks.start).toHaveBeenCalledOnce();
    expect(mocks.start).toHaveBeenCalledWith(shiftTimeChangedNotificationsWorkflow, [[
      "assignment-1",
      "assignment-2",
    ]]);
  });

  it("contains workflow-start failures instead of failing a committed shift update", async () => {
    mocks.start.mockRejectedValueOnce(new Error("workflow unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(scheduleShiftTimeChangedNotifications(["assignment-1"])).resolves.toBeNull();

    expect(consoleError).toHaveBeenCalledWith(
      "[Shift] failed to schedule time-change notifications",
      expect.objectContaining({ assignmentCount: 1 }),
    );
    consoleError.mockRestore();
  });
});
