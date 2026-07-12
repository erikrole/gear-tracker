import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const tx = {
  user: {
    create: vi.fn(),
  },
  allowedEmail: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    allowedEmail: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
  createAuditEntries: vi.fn(),
}));

import { createAuditEntries, createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  createAllowedEmailInvite,
  createAllowedEmailInvitesBulk,
  createDirectUserAccount,
  previewAllowedEmailInvitesBulk,
} from "@/lib/services/onboarding-lifecycle";

const admin = { id: "admin-1", role: "ADMIN" as const };
const staff = { id: "staff-1", role: "STAFF" as const };

type OnboardingTransaction = typeof tx;

function existingUser(row: unknown) {
  return row as Awaited<ReturnType<typeof db.user.findUnique>>;
}

function userRows(rows: unknown[]) {
  return rows as Awaited<ReturnType<typeof db.user.findMany>>;
}

function allowedEmailRow(row: unknown) {
  return row as Awaited<ReturnType<typeof db.allowedEmail.create>>;
}

function allowedEmailRows(rows: unknown[]) {
  return rows as Awaited<ReturnType<typeof db.allowedEmail.findMany>>;
}

function createManyResult(count: number) {
  return { count } as Awaited<ReturnType<typeof db.allowedEmail.createMany>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.$transaction).mockImplementation(async (fn) =>
    (fn as unknown as (transaction: OnboardingTransaction) => Promise<unknown>)(tx)
  );
});

describe("onboarding lifecycle service", () => {
  it("creates direct users with forced password and a claimed allowlist row", async () => {
    const claimedAt = new Date("2026-06-03T12:00:00.000Z");
    tx.user.create.mockResolvedValue({
      id: "user-1",
      name: "Student One",
      email: "student@uw.edu",
      role: "STUDENT",
      locationId: null,
      location: null,
    });
    tx.allowedEmail.findUnique.mockResolvedValue(null);
    tx.allowedEmail.create.mockResolvedValue({
      id: "allowed-1",
      email: "student@uw.edu",
      role: "STUDENT",
      claimedAt,
      claimedById: "user-1",
    });

    const result = await createDirectUserAccount({
      actor: admin,
      name: "Student One",
      email: "Student@UW.edu",
      passwordHash: "hashed-password",
      role: "STUDENT",
      locationId: null,
    });

    expect(result.created.id).toBe("user-1");
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "student@uw.edu",
          forcePasswordChange: true,
          role: "STUDENT",
        }),
      }),
    );
    expect(tx.allowedEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "student@uw.edu",
          role: "STUDENT",
          createdById: "admin-1",
          claimedById: "user-1",
        }),
      }),
    );
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "user",
        action: "created",
        after: expect.objectContaining({ forcePasswordChange: true }),
      }),
    );
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "allowed_email",
        action: "created",
        after: expect.objectContaining({
          source: "direct_user_create",
          claimedById: "user-1",
        }),
      }),
    );
  });

  it("claims an existing pending invite when directly creating that user", async () => {
    tx.user.create.mockResolvedValue({
      id: "user-1",
      name: "Student One",
      email: "student@uw.edu",
      role: "STUDENT",
      locationId: null,
      location: null,
    });
    tx.allowedEmail.findUnique.mockResolvedValue({
      id: "allowed-1",
      email: "student@uw.edu",
      role: "STUDENT",
      claimedAt: null,
      claimedById: null,
    });
    tx.allowedEmail.update.mockResolvedValue({
      id: "allowed-1",
      email: "student@uw.edu",
      role: "STUDENT",
      claimedAt: new Date("2026-06-03T12:00:00.000Z"),
      claimedById: "user-1",
    });

    await createDirectUserAccount({
      actor: admin,
      name: "Student One",
      email: "student@uw.edu",
      passwordHash: "hashed-password",
      role: "STUDENT",
    });

    expect(tx.allowedEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "allowed-1" },
        data: expect.objectContaining({
          role: "STUDENT",
          claimedById: "user-1",
        }),
      }),
    );
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "allowed_email",
        action: "claimed",
      }),
    );
  });

  it("blocks staff from inviting staff accounts", async () => {
    await expect(
      createAllowedEmailInvite({
        actor: staff,
        email: "staff@uw.edu",
        role: "STAFF",
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: "Only admins can pre-approve staff accounts",
    });
  });

  it("backfills a claimed allowlist row for an existing registered user", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(existingUser({ id: "existing-user", role: "STAFF" }));
    vi.mocked(db.allowedEmail.create).mockResolvedValue(allowedEmailRow({
      id: "allowed-1",
      email: "existing@uw.edu",
      role: "STAFF",
      claimedAt: new Date("2026-06-03T12:00:00.000Z"),
      claimedById: "existing-user",
    }));

    const result = await createAllowedEmailInvite({
      actor: admin,
      email: "Existing@UW.edu",
      role: "STUDENT",
    });

    expect(result.skipped).toBe(false);
    expect(db.allowedEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "existing@uw.edu",
          role: "STAFF",
          claimedById: "existing-user",
        }),
      }),
    );
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "allowed_email",
        after: expect.objectContaining({ source: "registered_user_backfill" }),
      }),
    );
  });

  it("returns a generic skip for duplicate invite creation", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.allowedEmail.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await createAllowedEmailInvite({
      actor: admin,
      email: "existing@uw.edu",
      role: "STUDENT",
    });

    expect(result).toEqual({
      skipped: true,
      email: "existing@uw.edu",
      role: "STUDENT",
    });
    expect(createAuditEntry).not.toHaveBeenCalled();
  });

  it("bulk invite creation preserves generic skip counts and batched audit writes", async () => {
    vi.mocked(db.allowedEmail.findMany)
      .mockResolvedValueOnce(allowedEmailRows([{ email: "existing@uw.edu" }]))
      .mockResolvedValueOnce(allowedEmailRows([{ id: "allowed-1", email: "new@uw.edu", role: "STUDENT" }]));
    vi.mocked(db.user.findMany).mockResolvedValue([]);
    vi.mocked(db.allowedEmail.createMany).mockResolvedValue(createManyResult(1));

    const result = await createAllowedEmailInvitesBulk({
      actor: admin,
      emails: [
        { email: "New@UW.edu", role: "STUDENT" },
        { email: "Existing@UW.edu", role: "STUDENT" },
      ],
    });

    expect(result).toEqual({ created: 1, skipped: 1 });
    expect(db.allowedEmail.createMany).toHaveBeenCalledWith({
      data: [
        {
          email: "new@uw.edu",
          role: "STUDENT",
          createdById: "admin-1",
        },
      ],
      skipDuplicates: true,
    });
    expect(createAuditEntries).toHaveBeenCalledWith([
      expect.objectContaining({
        entityType: "allowed_email",
        entityId: "allowed-1",
        action: "created",
      }),
    ]);
  });

  it("previews bulk invite account status without creating rows", async () => {
    vi.mocked(db.allowedEmail.findMany).mockResolvedValue(allowedEmailRows([
      { email: "pending@uw.edu", role: "STUDENT", claimedAt: null },
      { email: "claimed@uw.edu", role: "STAFF", claimedAt: new Date("2026-06-03T12:00:00.000Z") },
    ]));
    vi.mocked(db.user.findMany).mockResolvedValue(userRows([
      { email: "existing@uw.edu", role: "STUDENT" },
    ]));

    const result = await previewAllowedEmailInvitesBulk({
      actor: admin,
      emails: [
        { email: "Ready@UW.edu", role: "STUDENT" },
        { email: "Pending@UW.edu", role: "STUDENT" },
        { email: "Claimed@UW.edu", role: "STAFF" },
        { email: "Existing@UW.edu", role: "STUDENT" },
        { email: "Ready@UW.edu", role: "STUDENT" },
      ],
    });

    expect(result.summary).toEqual({
      ready: 1,
      pending_invite: 1,
      claimed_invite: 1,
      existing_user: 1,
      duplicate: 1,
    });
    expect(result.rows.map((row) => row.status)).toEqual([
      "ready",
      "pending_invite",
      "claimed_invite",
      "existing_user",
      "duplicate",
    ]);
    expect(db.allowedEmail.createMany).not.toHaveBeenCalled();
    expect(createAuditEntries).not.toHaveBeenCalled();
  });

  it("bulk creates direct users with forced passwords and claimed allowlist rows", async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([]);
    tx.user.create
      .mockResolvedValueOnce({
        id: "user-1",
        name: "Student One",
        email: "one@uw.edu",
        role: "STUDENT",
        locationId: "loc-1",
        location: { name: "Camp Randall" },
      })
      .mockResolvedValueOnce({
        id: "user-2",
        name: "Student Two",
        email: "two@uw.edu",
        role: "STUDENT",
        locationId: null,
        location: null,
      });
    tx.allowedEmail.findUnique.mockResolvedValue(null);
    tx.allowedEmail.create
      .mockResolvedValueOnce({
        id: "allowed-1",
        email: "one@uw.edu",
        role: "STUDENT",
        claimedAt: new Date("2026-06-04T12:00:00.000Z"),
        claimedById: "user-1",
      })
      .mockResolvedValueOnce({
        id: "allowed-2",
        email: "two@uw.edu",
        role: "STUDENT",
        claimedAt: new Date("2026-06-04T12:00:00.000Z"),
        claimedById: "user-2",
      });

    const { createDirectUserAccountsBulk } = await import("@/lib/services/onboarding-lifecycle");
    const result = await createDirectUserAccountsBulk({
      actor: admin,
      users: [
        { name: "Student One", email: "One@UW.edu", role: "STUDENT", locationId: "loc-1", passwordHash: "hash-1" },
        { name: "Student Two", email: "Two@UW.edu", role: "STUDENT", locationId: null, passwordHash: "hash-2" },
      ],
    });

    expect(result.created).toHaveLength(2);
    expect(tx.user.create).toHaveBeenCalledTimes(2);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "one@uw.edu",
          forcePasswordChange: true,
          locationId: "loc-1",
        }),
      }),
    );
    expect(createAuditEntries).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: "user",
          entityId: "user-1",
          after: expect.objectContaining({ source: "bulk_direct_user_create" }),
        }),
        expect.objectContaining({
          entityType: "allowed_email",
          entityId: "allowed-1",
        }),
      ]),
    );
  });

  it("blocks admin rows from bulk onboarding even for admins", async () => {
    const { createDirectUserAccountsBulk } = await import("@/lib/services/onboarding-lifecycle");

    await expect(
      createDirectUserAccountsBulk({
        actor: admin,
        users: [
          { name: "Admin Two", email: "admin2@uw.edu", role: "ADMIN", passwordHash: "hash-1" },
        ],
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: "Bulk onboarding can only create staff or student users",
    });

    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});
