import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: { createMany: mocks.createMany },
  },
}));

import { createAuditEntries, createAuditEntriesTx } from "@/lib/audit";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createMany.mockResolvedValue({ count: 0 });
});

describe("audit batch helpers", () => {
  it("does not issue an empty database insert", async () => {
    await createAuditEntries([]);

    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("writes multiple audit rows in one insert with actor roles and snapshots intact", async () => {
    await createAuditEntries([
      {
        actorId: "admin-1",
        actorRole: Role.ADMIN,
        entityType: "booking",
        entityId: "booking-1",
        action: "created",
        before: { status: "DRAFT" },
      },
      {
        actorId: "staff-1",
        actorRole: Role.STAFF,
        entityType: "asset",
        entityId: "asset-1",
        action: "updated",
        after: { status: "READY" },
      },
    ]);

    expect(mocks.createMany).toHaveBeenCalledOnce();
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [
        {
          actorUserId: "admin-1",
          entityType: "booking",
          entityId: "booking-1",
          action: "created",
          beforeJson: { status: "DRAFT" },
          afterJson: { _actorRole: "ADMIN" },
        },
        {
          actorUserId: "staff-1",
          entityType: "asset",
          entityId: "asset-1",
          action: "updated",
          beforeJson: undefined,
          afterJson: { status: "READY", _actorRole: "STAFF" },
        },
      ],
    });
  });

  it("uses the supplied transaction client and preserves a system actor as null metadata", async () => {
    const transactionCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = { auditLog: { createMany: transactionCreateMany } };

    await createAuditEntriesTx(tx as never, [{
      actorId: null,
      actorRole: null,
      entityType: "kiosk",
      entityId: "kiosk-1",
      action: "activated",
    }]);

    expect(transactionCreateMany).toHaveBeenCalledWith({
      data: [{
        actorUserId: undefined,
        entityType: "kiosk",
        entityId: "kiosk-1",
        action: "activated",
        beforeJson: undefined,
        afterJson: { _actorRole: null },
      }],
    });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});
