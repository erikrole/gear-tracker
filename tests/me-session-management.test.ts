import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, Role } from "@prisma/client";

declare global {
  var __meSessionTransactionOptions: unknown;
}

const txMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  session: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn(),
  },
  session: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

const cookieJar = vi.hoisted(() => ({
  value: "raw-session-token" as string | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => (cookieJar.value ? { value: cookieJar.value } : undefined)),
  })),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  tokenHash: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntryTx: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    sessionCookieName: "app_session",
    trustedOrigins: ["https://app.example.com"],
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

import { requireAuth, tokenHash, verifyPassword, hashPassword } from "@/lib/auth";
import { createAuditEntryTx } from "@/lib/audit";
import { DELETE as revokeOtherSessions } from "@/app/api/me/sessions/route";
import { DELETE as revokeSession } from "@/app/api/me/sessions/[id]/route";
import { POST as changePassword } from "@/app/api/me/change-password/route";

const user = {
  id: "user-1",
  email: "user@example.com",
  name: "User One",
  role: Role.STAFF,
  avatarUrl: null,
  forcePasswordChange: false,
};

function request(path: string, body?: Record<string, unknown>) {
  return new Request(`https://app.example.com${path}`, {
    method: body ? "POST" : "DELETE",
    headers: {
      "content-type": "application/json",
      origin: "https://app.example.com",
      host: "app.example.com",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__meSessionTransactionOptions = undefined;
  cookieJar.value = "raw-session-token";
  dbMock.$transaction.mockImplementation(
    async (fn: (tx: typeof txMock) => Promise<unknown>, options?: unknown) => {
      globalThis.__meSessionTransactionOptions = options;
      return fn(txMock);
    },
  );
  vi.mocked(requireAuth).mockResolvedValue(user);
  vi.mocked(tokenHash).mockResolvedValue("hashed-session-token");
  vi.mocked(verifyPassword).mockResolvedValue(true);
  vi.mocked(hashPassword).mockResolvedValue("new-password-hash");
  dbMock.user.findUnique.mockResolvedValue({
    id: "user-1",
    passwordHash: "old-password-hash",
    forcePasswordChange: false,
  });
  txMock.user.findUnique.mockResolvedValue({
    passwordHash: "old-password-hash",
    forcePasswordChange: false,
  });
  txMock.user.update.mockResolvedValue({ id: "user-1" });
  txMock.session.findUnique.mockResolvedValue({
    id: "current-session",
    userId: "user-1",
  });
  txMock.session.deleteMany.mockResolvedValue({ count: 2 });
});

describe("self-service session management", () => {
  it("revokes every session except the verified current session", async () => {
    const res = await revokeOtherSessions(request("/api/me/sessions"), { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.revokedCount).toBe(2);
    expect(txMock.session.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        id: { not: "current-session" },
      },
    });
    expect(createAuditEntryTx).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        actorId: "user-1",
        entityType: "session",
        entityId: "user-1",
        action: "session_revoked",
        after: expect.objectContaining({
          scope: "all_other",
          revokedSessionCount: 2,
          preservedSessionId: "current-session",
        }),
      }),
    );
    expect(globalThis.__meSessionTransactionOptions).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("does not bulk-delete sessions when the current session cannot be re-identified", async () => {
    txMock.session.findUnique.mockResolvedValueOnce(null);

    const res = await revokeOtherSessions(request("/api/me/sessions"), { params: Promise.resolve({}) });

    expect(res.status).toBe(401);
    expect(txMock.session.deleteMany).not.toHaveBeenCalled();
    expect(createAuditEntryTx).not.toHaveBeenCalled();
  });

  it("changes password and revokes other sessions only after verifying the current session", async () => {
    const res = await changePassword(
      request("/api/me/change-password", {
        currentPassword: "old-password",
        newPassword: "new-password",
        revokeOtherSessions: true,
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(txMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "new-password-hash", forcePasswordChange: false },
    });
    expect(txMock.session.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        id: { not: "current-session" },
      },
    });
    expect(createAuditEntryTx).toHaveBeenNthCalledWith(
      1,
      txMock,
      expect.objectContaining({
        entityType: "user",
        entityId: "user-1",
        action: "password_change",
        before: { forcePasswordChange: false },
        after: {
          forcePasswordChange: false,
          revokedOtherSessions: true,
          revokedSessionCount: 2,
        },
      }),
    );
    expect(createAuditEntryTx).toHaveBeenNthCalledWith(
      2,
      txMock,
      expect.objectContaining({
        entityType: "session",
        entityId: "user-1",
        action: "session_revoked",
      }),
    );
  });

  it("does not change password when revoke-other-sessions cannot verify the current session", async () => {
    txMock.session.findUnique.mockResolvedValueOnce(null);

    const res = await changePassword(
      request("/api/me/change-password", {
        currentPassword: "old-password",
        newPassword: "new-password",
        revokeOtherSessions: true,
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(401);
    expect(txMock.user.update).not.toHaveBeenCalled();
    expect(txMock.session.deleteMany).not.toHaveBeenCalled();
    expect(createAuditEntryTx).not.toHaveBeenCalled();
  });

  it("audits a password change without exposing password or hash material", async () => {
    const res = await changePassword(
      request("/api/me/change-password", {
        currentPassword: "old-password",
        newPassword: "new-password",
        revokeOtherSessions: false,
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(txMock.session.deleteMany).not.toHaveBeenCalled();
    expect(createAuditEntryTx).toHaveBeenCalledTimes(1);
    const auditEntry = vi.mocked(createAuditEntryTx).mock.calls[0]?.[1];
    expect(auditEntry).toMatchObject({
      entityType: "user",
      entityId: "user-1",
      action: "password_change",
      after: {
        revokedOtherSessions: false,
        revokedSessionCount: 0,
      },
    });
    expect(JSON.stringify(auditEntry)).not.toContain("old-password");
    expect(JSON.stringify(auditEntry)).not.toContain("new-password");
    expect(JSON.stringify(auditEntry)).not.toContain("passwordHash");
    expect(JSON.stringify(auditEntry)).not.toContain("session-token");
  });

  it("revokes one owned non-current session with an audit snapshot", async () => {
    txMock.session.findUnique
      .mockResolvedValueOnce({ id: "current-session", userId: "user-1" })
      .mockResolvedValueOnce({
        id: "other-session",
        userId: "user-1",
        createdAt: new Date("2026-07-01T12:00:00.000Z"),
        expiresAt: new Date("2026-08-01T12:00:00.000Z"),
      });
    txMock.session.deleteMany.mockResolvedValueOnce({ count: 1 });

    const res = await revokeSession(
      request("/api/me/sessions/other-session"),
      { params: Promise.resolve({ id: "other-session" }) },
    );

    expect(res.status).toBe(200);
    expect(txMock.session.deleteMany).toHaveBeenCalledWith({
      where: { id: "other-session", userId: "user-1" },
    });
    expect(createAuditEntryTx).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        entityType: "session",
        entityId: "other-session",
        action: "session_revoked",
        before: {
          createdAt: "2026-07-01T12:00:00.000Z",
          expiresAt: "2026-08-01T12:00:00.000Z",
          active: true,
        },
        after: expect.objectContaining({
          scope: "single",
          revoked: true,
          preservedSessionId: "current-session",
        }),
      }),
    );
  });

  it("refuses to revoke the current session", async () => {
    const res = await revokeSession(
      request("/api/me/sessions/current-session"),
      { params: Promise.resolve({ id: "current-session" }) },
    );

    expect(res.status).toBe(400);
    expect(txMock.session.deleteMany).not.toHaveBeenCalled();
    expect(createAuditEntryTx).not.toHaveBeenCalled();
  });

  it("does not reveal or revoke a session owned by another user", async () => {
    txMock.session.findUnique
      .mockResolvedValueOnce({ id: "current-session", userId: "user-1" })
      .mockResolvedValueOnce({
        id: "foreign-session",
        userId: "user-2",
        createdAt: new Date("2026-07-01T12:00:00.000Z"),
        expiresAt: new Date("2026-08-01T12:00:00.000Z"),
      });

    const res = await revokeSession(
      request("/api/me/sessions/foreign-session"),
      { params: Promise.resolve({ id: "foreign-session" }) },
    );

    expect(res.status).toBe(404);
    expect(txMock.session.deleteMany).not.toHaveBeenCalled();
    expect(createAuditEntryTx).not.toHaveBeenCalled();
  });
});
