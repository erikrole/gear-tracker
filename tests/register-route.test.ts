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
    affiliation: null,
    collaboratorProfile: null,
    collaboratorPolicyId: null,
    collaboratorPolicy: null,
    claimedAt: null,
  } as unknown as Awaited<ReturnType<typeof db.allowedEmail.findUnique>>;
}

function createdUser(role: Role, wiscardNumber: string | null) {
  return {
    id: `user-${role.toLowerCase()}`,
    name: `${role} User`,
    email: `${role.toLowerCase()}@example.com`,
    role,
    affiliation: null,
    collaboratorProfile: null,
    collaboratorPolicyId: null,
    collaboratorPolicy: null,
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
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        role,
        wiscardNumber: null,
      }),
    }));
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ wiscardLinked: false }),
      }),
    );
  });

  it("ignores legacy Wiscard input so setup owns card-number collection", async () => {
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue(allowedInvite(Role.STUDENT));
    tx.user.create.mockResolvedValue(createdUser(Role.STUDENT, null));

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
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        wiscardNumber: null,
      }),
    }));
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ wiscardLinked: false }),
      }),
    );
  });

  it("propagates an active BTN policy and ignores Wiscard input", async () => {
    const policy = {
      id: "policy-btn",
      status: "ACTIVE",
      version: 1,
      affiliation: { key: "BIG_TEN_NETWORK", displayName: "Big Ten Network", badgeLabel: "BTN" },
      grants: [
        "GEAR_CATALOG_VIEW", "MY_GEAR_VIEW", "RESERVATION_CREATE", "RESERVATION_EDIT_OWN",
        "RESERVATION_CANCEL_OWN", "RESERVATION_EXTEND_OWN", "PUBLISHED_SCHEDULE_VIEW",
        "SCHEDULE_FOLLOW", "KIOSK_ROSTER_ELIGIBLE",
      ].map((capabilityKey) => ({ capabilityKey })),
    };
    vi.mocked(db.allowedEmail.findUnique).mockResolvedValue({
      ...allowedInvite(Role.COLLABORATOR),
      email: "trey@example.com",
      affiliation: "BIG_TEN_NETWORK",
      collaboratorProfile: "BTN_STANDARD",
      collaboratorPolicyId: policy.id,
      collaboratorPolicy: policy,
    } as Awaited<ReturnType<typeof db.allowedEmail.findUnique>>);
    tx.user.create.mockResolvedValue({
      ...createdUser(Role.COLLABORATOR, null),
      email: "trey@example.com",
      affiliation: "BIG_TEN_NETWORK",
      collaboratorProfile: "BTN_STANDARD",
      collaboratorPolicyId: policy.id,
      collaboratorPolicy: policy,
    });

    const response = await POST(
      postRegister({
        name: "Trey Escobar",
        email: "trey@example.com",
        wiscardNumber: "should-not-be-stored",
        password: "long-enough-password",
      }),
      noParams,
    );

    expect(response.status).toBe(201);
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        role: Role.COLLABORATOR,
        affiliation: "BIG_TEN_NETWORK",
        collaboratorProfile: "BTN_STANDARD",
        collaboratorPolicyId: "policy-btn",
        wiscardNumber: null,
      }),
    }));
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      user: expect.objectContaining({
        affiliation: "BIG_TEN_NETWORK",
        collaboratorProfile: "BTN_STANDARD",
        capabilities: policy.grants.map((grant) => grant.capabilityKey),
      }),
    }));
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
      createdUser(Role.STUDENT, null) as unknown as Awaited<ReturnType<typeof db.user.findUnique>>,
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
