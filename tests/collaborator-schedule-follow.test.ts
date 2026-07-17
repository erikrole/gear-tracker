import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const txMock = vi.hoisted(() => ({
  shiftGroup: { findFirst: vi.fn() },
  scheduleEventFollow: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/audit", () => ({ createAuditEntryTx: vi.fn() }));

import { createAuditEntryTx } from "@/lib/audit";
import { setPublishedScheduleFollow } from "@/lib/services/collaborator-schedule";

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.$transaction.mockImplementation(async (callback) => callback(txMock));
  txMock.shiftGroup.findFirst.mockResolvedValue({ id: "group-1" });
  txMock.scheduleEventFollow.findUnique.mockResolvedValue(null);
  txMock.scheduleEventFollow.upsert.mockResolvedValue({ mutedAt: null });
});

describe("published Schedule follow mutation", () => {
  it("writes follow state and audit evidence in one transaction", async () => {
    const result = await setPublishedScheduleFollow({
      eventId: "event-1",
      userId: "btn-1",
      actorRole: Role.COLLABORATOR,
      following: true,
    });

    expect(result).toEqual({ eventId: "event-1", isFollowing: true, changed: true });
    expect(txMock.scheduleEventFollow.upsert).toHaveBeenCalledTimes(1);
    expect(createAuditEntryTx).toHaveBeenCalledWith(txMock, expect.objectContaining({
      actorId: "btn-1",
      actorRole: Role.COLLABORATOR,
      action: "followed",
    }));
  });

  it("is a no-op when the requested follow state already matches", async () => {
    txMock.scheduleEventFollow.findUnique.mockResolvedValue({ mutedAt: null });

    const result = await setPublishedScheduleFollow({
      eventId: "event-1",
      userId: "btn-1",
      actorRole: Role.COLLABORATOR,
      following: true,
    });

    expect(result).toEqual({ eventId: "event-1", isFollowing: true, changed: false });
    expect(txMock.scheduleEventFollow.upsert).not.toHaveBeenCalled();
    expect(createAuditEntryTx).not.toHaveBeenCalled();
  });

  it("refuses to follow a draft or hidden event", async () => {
    txMock.shiftGroup.findFirst.mockResolvedValue(null);

    await expect(setPublishedScheduleFollow({
      eventId: "event-1",
      userId: "btn-1",
      actorRole: Role.COLLABORATOR,
      following: true,
    })).rejects.toMatchObject({ status: 404 });

    expect(txMock.scheduleEventFollow.upsert).not.toHaveBeenCalled();
    expect(createAuditEntryTx).not.toHaveBeenCalled();
  });
});
