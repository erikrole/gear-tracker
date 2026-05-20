import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  tokenHash: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

const mockTx = {
  passwordResetToken: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
  session: {
    deleteMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (input: unknown, _options?: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
    }),
    user: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth, tokenHash, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditEntry } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { PATCH as patchProfile } from "@/app/api/profile/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";

function authedRequest(path: string, body: Record<string, unknown>) {
  return new Request(`https://app.example.com${path}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

function publicPost(path: string, body: Record<string, unknown>) {
  return new Request(`https://app.example.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue({
    id: "user-1",
    email: "user@example.com",
    name: "User One",
    role: "STAFF" as any,
    avatarUrl: null,
    forcePasswordChange: false,
  });
  vi.mocked(hashPassword).mockResolvedValue("next-hash");
  vi.mocked(verifyPassword).mockResolvedValue(true);
  vi.mocked(tokenHash).mockResolvedValue("hashed-token");
  vi.mocked(checkRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  });
  vi.mocked(getClientIp).mockReturnValue("127.0.0.1");

  vi.mocked(db.user.findUniqueOrThrow).mockResolvedValue({
    id: "user-1",
    passwordHash: "old-hash",
  } as any);
  vi.mocked(db.user.update).mockResolvedValue({ id: "user-1" } as any);
  vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 2 } as any);

  mockTx.passwordResetToken.findUnique.mockResolvedValue({
    id: "token-1",
    userId: "user-1",
    expiresAt: new Date(Date.now() + 60_000),
    user: { id: "user-1", role: "STUDENT" },
  });
  mockTx.passwordResetToken.deleteMany
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValue({ count: 0 });
  mockTx.user.update.mockResolvedValue({ id: "user-1" });
  mockTx.session.deleteMany.mockResolvedValue({ count: 3 });
});

describe("auth hardening", () => {
  it("BUG: self-service password change invalidates existing sessions atomically", async () => {
    const res = await patchProfile(
      authedRequest("/api/profile", {
        action: "change_password",
        currentPassword: "old-password",
        newPassword: "new-password",
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "next-hash", forcePasswordChange: false },
    });
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(db.$transaction).toHaveBeenCalledWith([
      expect.any(Promise),
      expect.any(Promise),
    ]);
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "password_change",
      }),
    );
  });

  it("BUG: password reset consumes the token inside a Serializable transaction", async () => {
    const res = await resetPassword(
      publicPost("/api/auth/reset-password", {
        token: "raw-token",
        password: "new-password",
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
    expect(mockTx.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: "hashed-token" },
      include: { user: { select: { id: true, role: true } } },
    });
    expect(mockTx.passwordResetToken.deleteMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: "token-1",
          expiresAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "next-hash", forcePasswordChange: false },
    });
    expect(mockTx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});
