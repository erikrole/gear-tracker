import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

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
import { db } from "@/lib/db";
import { POST } from "@/app/api/users/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin One",
  role: Role.ADMIN,
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
  it("retires first-time temporary-password user creation", async () => {
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

    expect(res.status).toBe(410);
    expect(body.error).toBe("Temporary-password onboarding has been retired. Add the email to the allowlist so the user can register and set their own password.");
    expect(hashPassword).not.toHaveBeenCalled();
    expect(mockTx.user.create).not.toHaveBeenCalled();
    expect(mockTx.allowedEmail.create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("does not allow admin direct-create requests either", async () => {
    const res = await POST(
      postUser({
        name: "Admin Two",
        email: "admin.two@example.com",
        password: "temporary-pass",
        role: "ADMIN",
        locationId: null,
      }),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body.error).toBe("Temporary-password onboarding has been retired. Add the email to the allowlist so the user can register and set their own password.");
    expect(hashPassword).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
