import { beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseCodeStatus, Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { $transaction: mocks.transaction },
}));

vi.mock("@/lib/services/notifications", () => ({
  sendPushToUser: vi.fn(),
}));

import { releaseCode } from "@/lib/services/licenses";

function releaseTx(remainingClaims: Array<{ userId: string | null; claimedAt: Date }>) {
  return {
    licenseCodeClaim: {
      findMany: vi.fn().mockResolvedValue(remainingClaims),
      findFirst: vi.fn().mockResolvedValue({
        id: "claim-released",
        licenseCodeId: "code-1",
        userId: "user-1",
        releasedAt: null,
      }),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "claim-released" }),
      updateMany: vi.fn(),
    },
    licenseCode: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "code-1",
        ...data,
      })),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockReset();
});

describe("Photo Mechanic license release concurrency", () => {
  it("retries the full serializable release and derives cached status from the winning snapshot", async () => {
    const concurrentClaimedAt = new Date("2026-08-19T15:00:00.000Z");
    const firstAttempt = releaseTx([]);
    const retryAttempt = releaseTx([{ userId: "user-2", claimedAt: concurrentClaimedAt }]);
    let attempt = 0;

    mocks.transaction.mockImplementation(async (
      operation: (tx: ReturnType<typeof releaseTx>) => Promise<unknown>,
    ) => {
      attempt += 1;
      const result = await operation(attempt === 1 ? firstAttempt : retryAttempt);
      if (attempt === 1) throw { code: "P2034" };
      return result;
    });

    const result = await releaseCode("code-1", "user-1", false, {}, "STUDENT");

    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(mocks.transaction).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(firstAttempt.licenseCode.update).toHaveBeenCalledWith({
      where: { id: "code-1" },
      data: {
        status: LicenseCodeStatus.AVAILABLE,
        claimedById: null,
        claimedAt: null,
        nagSentAt: null,
      },
    });
    expect(retryAttempt.licenseCode.update).toHaveBeenCalledWith({
      where: { id: "code-1" },
      data: {
        status: LicenseCodeStatus.PARTIAL,
        claimedById: "user-2",
        claimedAt: concurrentClaimedAt,
        nagSentAt: null,
      },
    });
    expect(retryAttempt.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "user-1",
        entityType: "license_code",
        entityId: "code-1",
        action: "release",
      }),
    });
    expect(result).toEqual(expect.objectContaining({
      id: "code-1",
      status: LicenseCodeStatus.PARTIAL,
      claimedById: "user-2",
    }));
  });
});
