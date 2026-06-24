import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/services/user-deactivation", () => ({
  deactivateUserWithCleanup: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({
  createAuditEntries: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntries } from "@/lib/audit";
import { db } from "@/lib/db";
import { cleanupHiddenUsers } from "@/lib/services/hidden-users-cleanup";
import { deactivateUserWithCleanup } from "@/lib/services/user-deactivation";
import { POST as cleanupRoute } from "@/app/api/users/hidden-cleanup/route";

const actor = {
  id: "owner-1",
  email: "owner@example.com",
  name: "Owner",
  role: Role.ADMIN,
  avatarUrl: null,
};

const hiddenCandidate = {
  id: "hidden-1",
  name: "Smoke User",
  email: "smoke@example.com",
  createdAt: new Date("2026-06-01T12:00:00.000Z"),
  updatedAt: new Date("2026-06-01T12:00:00.000Z"),
  lastActiveAt: null,
};

function postReq(body: unknown) {
  return new Request("https://app.example.com/api/users/hidden-cleanup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://app.example.com",
      host: "app.example.com",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.INTERNAL_OPERATOR_EMAILS;
  vi.mocked(requireAuth).mockResolvedValue(actor);
  vi.mocked(db.user.findMany).mockResolvedValue([hiddenCandidate] as never);
  vi.mocked(deactivateUserWithCleanup).mockResolvedValue({
    cancelledIds: [],
    directReportsCleared: 0,
  });
  vi.mocked(createAuditEntries).mockResolvedValue(undefined);
});

describe("hidden user cleanup", () => {
  it("dry-runs active hidden users older than the TTL without deactivating", async () => {
    const result = await cleanupHiddenUsers({
      actor: { id: actor.id, role: actor.role },
      dryRun: true,
      maxAgeDays: 14,
      limit: 10,
      now: new Date("2026-06-24T12:00:00.000Z"),
    });

    expect(db.user.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        hiddenFromRoster: true,
        createdAt: { lt: new Date("2026-06-10T12:00:00.000Z") },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        lastActiveAt: true,
      },
    });
    expect(result).toMatchObject({
      dryRun: true,
      scanned: 1,
      failed: [],
      deactivated: [{ id: "hidden-1", cancelledBookingIds: [], directReportsCleared: 0 }],
    });
    expect(deactivateUserWithCleanup).not.toHaveBeenCalled();
    expect(createAuditEntries).not.toHaveBeenCalled();
  });

  it("deactivates eligible hidden users and records cleanup audit entries when applied", async () => {
    vi.mocked(deactivateUserWithCleanup).mockResolvedValue({
      cancelledIds: ["booking-1"],
      directReportsCleared: 2,
    });

    const result = await cleanupHiddenUsers({
      actor: { id: actor.id, role: actor.role },
      dryRun: false,
      maxAgeDays: 7,
      limit: 5,
      now: new Date("2026-06-24T12:00:00.000Z"),
    });

    expect(deactivateUserWithCleanup).toHaveBeenCalledWith({
      targetUserId: "hidden-1",
      actorId: "owner-1",
      actorRole: Role.ADMIN,
    });
    expect(createAuditEntries).toHaveBeenCalledWith([
      expect.objectContaining({
        actorId: "owner-1",
        actorRole: Role.ADMIN,
        entityType: "user",
        entityId: "hidden-1",
        action: "hidden_smoke_user_cleanup_deactivated",
        before: { active: true, hiddenFromRoster: true },
        after: expect.objectContaining({
          active: false,
          hiddenFromRoster: true,
          maxAgeDays: 7,
          cancelledBookingIds: ["booking-1"],
          directReportsCleared: 2,
        }),
      }),
    ]);
    expect(result).toMatchObject({
      dryRun: false,
      scanned: 1,
      deactivated: [{ id: "hidden-1", cancelledBookingIds: ["booking-1"], directReportsCleared: 2 }],
      failed: [],
    });
  });

  it("rejects non-internal operators at the API boundary", async () => {
    const res = await cleanupRoute(postReq({ dryRun: true }), { params: Promise.resolve({}) });

    expect(res.status).toBe(403);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("allows configured internal operators to run the cleanup route", async () => {
    process.env.INTERNAL_OPERATOR_EMAILS = "owner@example.com";

    const res = await cleanupRoute(postReq({ dryRun: false, maxAgeDays: 21, limit: 3 }), {
      params: Promise.resolve({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({ dryRun: false, scanned: 1 });
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
    expect(deactivateUserWithCleanup).toHaveBeenCalledWith(expect.objectContaining({ targetUserId: "hidden-1" }));
  });
});
