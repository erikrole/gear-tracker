import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTx = {
  user: {
    create: vi.fn(),
  },
  allowedEmail: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (input: unknown) => {
      return (input as (tx: typeof mockTx) => Promise<unknown>)(mockTx);
    }),
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth, hashPassword } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { POST } from "@/app/api/users/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin One",
  role: "ADMIN" as any,
  avatarUrl: null,
};

function postUser(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/users", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(adminUser);
  vi.mocked(hashPassword).mockResolvedValue("hashed-temp-password");
  mockTx.user.create.mockResolvedValue({
    id: "user-1",
    name: "New Staff",
    email: "new.staff@example.com",
    role: "STAFF",
    locationId: null,
    location: null,
  });
  mockTx.allowedEmail.findUnique.mockResolvedValue(null);
  mockTx.allowedEmail.create.mockResolvedValue({
    id: "allow-1",
    email: "new.staff@example.com",
    role: "STAFF",
    claimedAt: new Date("2026-05-12T12:00:00.000Z"),
    claimedById: "user-1",
  });
});

describe("POST /api/users", () => {
  it("creates temporary-password users with a forced password change and claimed allowlist record", async () => {
    const res = await POST(
      postUser({
        name: "New Staff",
        email: "New.Staff@Example.com",
        password: "temporary-pass",
        role: "STAFF",
        locationId: null,
      }),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new.staff@example.com",
          passwordHash: "hashed-temp-password",
          forcePasswordChange: true,
          role: "STAFF",
        }),
      }),
    );
    expect(mockTx.allowedEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new.staff@example.com",
          role: "STAFF",
          createdById: "admin-1",
          claimedById: "user-1",
          claimedAt: expect.any(Date),
        }),
      }),
    );
    expect(body.data.forcePasswordChange).toBe(true);
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
        after: expect.objectContaining({ source: "direct_user_create" }),
      }),
    );
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });

  it("claims an existing pending allowlist row when the user is created directly", async () => {
    mockTx.allowedEmail.findUnique.mockResolvedValue({
      id: "allow-1",
      email: "new.staff@example.com",
      role: "STUDENT",
      claimedAt: null,
      claimedById: null,
    });
    mockTx.allowedEmail.update.mockResolvedValue({
      id: "allow-1",
      email: "new.staff@example.com",
      role: "STAFF",
      claimedAt: new Date("2026-05-12T12:00:00.000Z"),
      claimedById: "user-1",
    });

    const res = await POST(
      postUser({
        name: "New Staff",
        email: "new.staff@example.com",
        password: "temporary-pass",
        role: "STAFF",
        locationId: null,
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(201);
    expect(mockTx.allowedEmail.create).not.toHaveBeenCalled();
    expect(mockTx.allowedEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "allow-1" },
        data: expect.objectContaining({
          role: "STAFF",
          claimedById: "user-1",
          claimedAt: expect.any(Date),
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
});
