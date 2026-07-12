import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const tx = {
  user: {
    create: vi.fn(),
  },
  allowedEmail: {
    update: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(async (input: unknown) => {
      return (input as (txArg: typeof tx) => Promise<unknown>)(tx);
    }),
    allowedEmail: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  createSession: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { createSession, hashPassword } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { POST } from "@/app/api/auth/register/route";

function postRegister(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

function allowedInvite(role: Role) {
  return {
    id: `invite-${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@example.com`,
    role,
    claimedAt: null,
  } as Awaited<ReturnType<typeof db.allowedEmail.findUnique>>;
}

function createdUser(role: Role, wiscardNumber: string | null) {
  return {
    id: `user-${role.toLowerCase()}`,
    name: `${role} User`,
    email: `${role.toLowerCase()}@example.com`,
    role,
    staffingType: role === Role.STUDENT ? "ST" : "FT",
    wiscardNumber,
  };
}

const noParams = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(checkRateLimit).mockResolvedValue({
    allowed: true,
    remaining: 39,
    resetAt: Date.now() + 60_000,
  });
  vi.mocked(getClientIp).mockReturnValue("127.0.0.1");
  vi.mocked(hashPassword).mockResolvedValue("hashed-password");
  vi.mocked(createSession).mockResolvedValue(undefined);
  vi.mocked(createAuditEntry).mockResolvedValue(undefined);
  vi.mocked(db.user.findUnique).mockResolvedValue(null);
  tx.allowedEmail.update.mockResolvedValue({});
});

describe("POST /api/auth/register", () => {
  it.each([Role.STUDENT, Role.STAFF])("allows %s invites to register without Wiscard values", async (role) => {
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue(allowedInvite(role));
    tx.user.create.mockResolvedValue(createdUser(role, null));

    const response = await POST(
      postRegister({
        name: `${role} User`,
        email: `${role.toLowerCase()}@example.com`,
        password: "long-enough-password",
      }),
      noParams,
    );

    expect(response.status).toBe(201);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role,
        wiscardNumber: null,
      }),
    });
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ wiscardLinked: false }),
      }),
    );
  });

  it("still stores a provided scanned Wiscard value for later kiosk identity lookup", async () => {
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue(allowedInvite(Role.STUDENT));
    tx.user.create.mockResolvedValue(createdUser(Role.STUDENT, "90703248102"));

    const response = await POST(
      postRegister({
        name: "Student User",
        email: "student@example.com",
        wiscardNumber: " 90703248102 ",
        password: "long-enough-password",
      }),
      noParams,
    );

    expect(response.status).toBe(201);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        wiscardNumber: "90703248102",
      }),
    });
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ wiscardLinked: true }),
      }),
    );
  });

  it("returns one indistinguishable response for missing, claimed, and registered emails", async () => {
    const registerBody = {
      name: "Probe User",
      email: "probe@example.com",
      password: "long-enough-password",
    };

    // Missing invite
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue(null);
    const missing = await POST(postRegister(registerBody), noParams);

    // Claimed invite
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue({
      ...allowedInvite(Role.STUDENT),
      claimedAt: new Date(),
    } as Awaited<ReturnType<typeof db.allowedEmail.findUnique>>);
    const claimed = await POST(postRegister(registerBody), noParams);

    // Existing account behind an unclaimed invite
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue(allowedInvite(Role.STUDENT));
    vi.mocked(db.user.findUnique).mockResolvedValue(
      createdUser(Role.STUDENT, null) as Awaited<ReturnType<typeof db.user.findUnique>>,
    );
    const existing = await POST(postRegister(registerBody), noParams);

    const [missingBody, claimedBody, existingBody] = await Promise.all([
      missing.json(),
      claimed.json(),
      existing.json(),
    ]);

    expect(missing.status).toBe(403);
    expect(claimed.status).toBe(missing.status);
    expect(existing.status).toBe(missing.status);
    expect(claimedBody).toEqual(missingBody);
    expect(existingBody).toEqual(missingBody);
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});
