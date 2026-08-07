import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  publishShiftGroup: vi.fn(),
  createInitialNotifications: vi.fn(),
  notifyWorkers: vi.fn(),
  notifyFollowers: vi.fn(),
}));

vi.mock("workflow", () => ({ sleep: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    shiftGroupWorkingCopy: {
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
    },
  },
}));
vi.mock("@/lib/services/schedule-publication", () => ({
  publishShiftGroup: mocks.publishShiftGroup,
}));
vi.mock("@/lib/services/notifications", () => ({
  createPublishedShiftGroupNotifications: mocks.createInitialNotifications,
  notifyPublishedShiftGroupWorkers: mocks.notifyWorkers,
  notifyPublishedScheduleFollowers: mocks.notifyFollowers,
}));

import { releasePendingScheduleVersion } from "@/workflows/pending-schedule-release";

describe("pending schedule release step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      version: 4,
      updatedById: "staff-1",
      updatedBy: { role: "STAFF" },
    });
  });

  it("does nothing when a newer edit superseded the sleeping version", async () => {
    await expect(releasePendingScheduleVersion("group-1", 3)).resolves.toEqual({
      status: "superseded",
      shiftGroupId: "group-1",
      expectedVersion: 3,
    });
    expect(mocks.publishShiftGroup).not.toHaveBeenCalled();
  });

  it("releases only the exact stored version and sends one changed-worker batch", async () => {
    mocks.publishShiftGroup.mockResolvedValue({
      before: { publishedAt: "2026-08-07T12:00:00.000Z" },
      after: { publishedVersion: 7 },
      publishedSnapshotChanged: true,
      affectedUserIds: ["student-1"],
    });

    await expect(releasePendingScheduleVersion("group-1", 4)).resolves.toMatchObject({ status: "released" });
    expect(mocks.publishShiftGroup).toHaveBeenCalledWith("group-1", "staff-1", 4, "STAFF");
    expect(mocks.notifyWorkers).toHaveBeenCalledWith("group-1", ["student-1"]);
    expect(mocks.notifyFollowers).toHaveBeenCalledWith("group-1");
    expect(mocks.createInitialNotifications).not.toHaveBeenCalled();
  });

  it("persists a permanent validation blocker on the same pending version", async () => {
    mocks.publishShiftGroup.mockRejectedValue(new HttpError(409, "Resolve the active trade first."));

    await expect(releasePendingScheduleVersion("group-1", 4)).resolves.toMatchObject({
      status: "blocked",
      error: "Resolve the active trade first.",
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { shiftGroupId: "group-1", version: 4 },
      data: { autoReleaseError: "Resolve the active trade first." },
    });
  });
});
