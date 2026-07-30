import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionDeviceToken = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
}));
const transactionUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
    deviceToken: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
  SETTINGS_MUTATION_LIMIT: { max: 60, windowMs: 60_000 },
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { DELETE, POST } from "@/app/api/devices/route";

const user = {
  id: "user-1",
  email: "staff@example.com",
  name: "Staff User",
  role: "STAFF" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};

function deleteRequest(body?: string) {
  return new Request("https://app.example.com/api/devices", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body,
  });
}

function postRequest(body: unknown) {
  return new Request("https://app.example.com/api/devices", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

function routeParams() {
  return { params: Promise.resolve({}) };
}

describe("/api/devices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(user);
    vi.mocked(enforceRateLimit).mockResolvedValue(undefined);
    vi.mocked(db.deviceToken.updateMany).mockResolvedValue({ count: 1 } as never);
    transactionDeviceToken.findMany.mockResolvedValue([
      { id: "device-new" },
      { id: "device-2" },
    ]);
    transactionDeviceToken.updateMany.mockResolvedValue({ count: 0 });
    transactionDeviceToken.upsert.mockResolvedValue({ id: "device-new" });
    transactionUser.findUnique.mockResolvedValue({ active: true });
    vi.mocked(db.$transaction).mockImplementation((async (callback: unknown) => (
      callback as (tx: {
        deviceToken: typeof transactionDeviceToken;
        user: typeof transactionUser;
      }) => Promise<unknown>
    )({
      deviceToken: transactionDeviceToken,
      user: transactionUser,
    })) as never);
  });

  it("registers a bounded APNs token and prunes all older active devices transactionally", async () => {
    const token = "a1".repeat(32);
    const res = await POST(
      postRequest({ token, appVersion: "2026.7" }),
      routeParams(),
    );

    expect(res.status).toBe(200);
    expect(enforceRateLimit).toHaveBeenCalledWith(
      `devices:register:${user.id}`,
      SETTINGS_MUTATION_LIMIT,
    );
    expect(transactionUser.findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: { active: true },
    });
    expect(transactionDeviceToken.upsert).toHaveBeenCalledWith({
      where: { token },
      update: {
        userId: user.id,
        platform: "IOS",
        appVersion: "2026.7",
        lastSeenAt: expect.any(Date),
        revokedAt: null,
      },
      create: {
        userId: user.id,
        token,
        platform: "IOS",
        appVersion: "2026.7",
      },
    });
    expect(transactionDeviceToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: user.id, revokedAt: null },
        take: 8,
      }),
    );
    expect(transactionDeviceToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        revokedAt: null,
        id: { notIn: ["device-new", "device-2"] },
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(db.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
  });

  it("rejects a user deactivated after authentication inside the registration transaction", async () => {
    transactionUser.findUnique.mockResolvedValueOnce({ active: false });

    const res = await POST(
      postRequest({ token: "a1".repeat(32) }),
      routeParams(),
    );

    expect(res.status).toBe(401);
    expect(transactionUser.findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: { active: true },
    });
    expect(transactionDeviceToken.upsert).not.toHaveBeenCalled();
    expect(transactionDeviceToken.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ["odd-length", "abc"],
    ["non-hex", "gg"],
    ["oversized", "aa".repeat(257)],
  ])("rejects %s iOS APNs tokens without writing", async (_case, token) => {
    const res = await POST(postRequest({ token }), routeParams());

    expect(res.status).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("keeps opaque Android registration tokens compatible", async () => {
    const res = await POST(
      postRequest({ token: "firebase-installation-token", platform: "ANDROID" }),
      routeParams(),
    );

    expect(res.status).toBe(200);
    expect(transactionDeviceToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: "firebase-installation-token" },
        create: expect.objectContaining({ platform: "ANDROID" }),
      }),
    );
  });

  it("rate limits registration before parsing or writing", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(
      new HttpError(429, "Too many requests"),
    );

    const res = await POST(postRequest({ token: "a1".repeat(32) }), routeParams());

    expect(res.status).toBe(429);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON instead of revoking every device token", async () => {
    const res = await DELETE(deleteRequest("{not-json"), routeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
    expect(db.deviceToken.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty JSON object", {}],
    ["a misspelled token field", { tokne: "installation-token" }],
    ["an unexpected field", { token: "installation-token", revokeAll: true }],
  ])("rejects %s instead of falling through to revoke-all", async (_case, body) => {
    const res = await DELETE(
      deleteRequest(JSON.stringify(body)),
      routeParams(),
    );

    expect(res.status).toBe(400);
    expect(db.deviceToken.updateMany).not.toHaveBeenCalled();
  });

  it("keeps an intentionally empty body as the revoke-all contract", async () => {
    const res = await DELETE(deleteRequest(), routeParams());

    expect(res.status).toBe(200);
    expect(db.deviceToken.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("scopes token-specific revocation to the authenticated user", async () => {
    const res = await DELETE(
      deleteRequest(JSON.stringify({ token: "installation-token" })),
      routeParams(),
    );

    expect(res.status).toBe(200);
    expect(db.deviceToken.updateMany).toHaveBeenCalledWith({
      where: { token: "installation-token", userId: user.id },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
