import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  bookingFindUnique: vi.fn(),
  transaction: vi.fn(),
  liveTokenFindMany: vi.fn(),
  liveTokenUpdateMany: vi.fn(),
  liveTokenUpsert: vi.fn(),
  startTokenFindMany: vi.fn(),
  startTokenUpdateMany: vi.fn(),
  startTokenUpsert: vi.fn(),
  revokeStartTokens: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
  SETTINGS_MUTATION_LIMIT: { max: 60, windowMs: 60_000 },
}));

vi.mock("@/lib/services/live-activities", () => ({
  revokeCheckoutReturnLiveActivityStartTokens: mocks.revokeStartTokens,
}));

import { requireAuth } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { POST as registerLiveActivityPOST } from "@/app/api/live-activities/checkout-return/route";
import {
  DELETE as revokeStartTokensDELETE,
  POST as registerStartTokenPOST,
} from "@/app/api/live-activities/checkout-return/start-token/route";

const user = {
  id: "user-1",
  email: "student@example.com",
  name: "Student User",
  role: "STUDENT" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};

const transactionClient = {
  user: {
    findUnique: mocks.userFindUnique,
  },
  booking: {
    findUnique: mocks.bookingFindUnique,
  },
  liveActivityToken: {
    findMany: mocks.liveTokenFindMany,
    updateMany: mocks.liveTokenUpdateMany,
    upsert: mocks.liveTokenUpsert,
  },
  liveActivityStartToken: {
    findMany: mocks.startTokenFindMany,
    updateMany: mocks.startTokenUpdateMany,
    upsert: mocks.startTokenUpsert,
  },
};

function request(path: string, method: "POST" | "DELETE", body?: unknown) {
  return new Request(`https://app.example.com${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function routeParams() {
  return { params: Promise.resolve({}) };
}

describe("iOS Live Activity credential registration routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(user);
    vi.mocked(enforceRateLimit).mockResolvedValue(undefined);
    mocks.userFindUnique.mockResolvedValue({ active: true });
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      kind: "CHECKOUT",
      status: "OPEN",
      requesterUserId: user.id,
    });
    mocks.liveTokenFindMany.mockResolvedValue([
      { id: "live-new" },
      { id: "live-2" },
    ]);
    mocks.liveTokenUpdateMany.mockResolvedValue({ count: 0 });
    mocks.liveTokenUpsert.mockResolvedValue({ id: "live-new" });
    mocks.startTokenFindMany.mockResolvedValue([
      { id: "start-new" },
      { id: "start-2" },
    ]);
    mocks.startTokenUpdateMany.mockResolvedValue({ count: 0 });
    mocks.startTokenUpsert.mockResolvedValue({ id: "start-new" });
    mocks.revokeStartTokens.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback: unknown) => (
      callback as (tx: typeof transactionClient) => Promise<unknown>
    )(transactionClient));
  });

  it("registers and transactionally prunes all historical active tokens beyond one checkout's cap", async () => {
    const token = "b2".repeat(32);
    const res = await registerLiveActivityPOST(
      request(
        "/api/live-activities/checkout-return",
        "POST",
        { bookingId: "booking-1", token },
      ),
      routeParams(),
    );

    expect(res.status).toBe(200);
    expect(enforceRateLimit).toHaveBeenCalledWith(
      `live-activities:checkout-return:register:${user.id}`,
      SETTINGS_MUTATION_LIMIT,
    );
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: { active: true },
    });
    expect(mocks.liveTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        activity: "checkout_return",
        bookingId: { not: "booking-1" },
        endedAt: null,
      },
      data: { endedAt: expect.any(Date) },
    });
    expect(mocks.liveTokenUpsert).toHaveBeenCalledWith({
      where: { token },
      update: {
        userId: user.id,
        bookingId: "booking-1",
        activity: "checkout_return",
        lastSeenAt: expect.any(Date),
        endedAt: null,
      },
      create: {
        userId: user.id,
        bookingId: "booking-1",
        token,
        activity: "checkout_return",
      },
    });
    expect(mocks.liveTokenFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: user.id,
          bookingId: "booking-1",
          activity: "checkout_return",
          endedAt: null,
        },
        take: 4,
      }),
    );
    expect(mocks.liveTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        bookingId: "booking-1",
        activity: "checkout_return",
        endedAt: null,
        id: { notIn: ["live-new", "live-2"] },
      },
      data: { endedAt: expect.any(Date) },
    });
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" },
    );
  });

  it("registers and transactionally prunes all historical active push-to-start tokens beyond the user cap", async () => {
    const token = "c3".repeat(40);
    const res = await registerStartTokenPOST(
      request(
        "/api/live-activities/checkout-return/start-token",
        "POST",
        { token },
      ),
      routeParams(),
    );

    expect(res.status).toBe(200);
    expect(enforceRateLimit).toHaveBeenCalledWith(
      `live-activities:checkout-return:start-token:${user.id}`,
      SETTINGS_MUTATION_LIMIT,
    );
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: { active: true },
    });
    expect(mocks.startTokenUpsert).toHaveBeenCalledWith({
      where: { token },
      update: {
        userId: user.id,
        activity: "checkout_return",
        lastSeenAt: expect.any(Date),
        revokedAt: null,
      },
      create: {
        userId: user.id,
        token,
        activity: "checkout_return",
      },
    });
    expect(mocks.startTokenFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: user.id,
          activity: "checkout_return",
          revokedAt: null,
        },
        take: 8,
      }),
    );
    expect(mocks.startTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        activity: "checkout_return",
        revokedAt: null,
        id: { notIn: ["start-new", "start-2"] },
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("rejects a user deactivated after authentication inside both registration transactions", async () => {
    mocks.userFindUnique.mockResolvedValue({ active: false });
    const token = "d4".repeat(32);

    const activityRes = await registerLiveActivityPOST(
      request(
        "/api/live-activities/checkout-return",
        "POST",
        { bookingId: "booking-1", token },
      ),
      routeParams(),
    );
    const startRes = await registerStartTokenPOST(
      request(
        "/api/live-activities/checkout-return/start-token",
        "POST",
        { token },
      ),
      routeParams(),
    );

    expect(activityRes.status).toBe(401);
    expect(startRes.status).toBe(401);
    expect(mocks.userFindUnique).toHaveBeenCalledTimes(2);
    expect(mocks.bookingFindUnique).not.toHaveBeenCalled();
    expect(mocks.liveTokenUpsert).not.toHaveBeenCalled();
    expect(mocks.startTokenUpsert).not.toHaveBeenCalled();
  });

  it.each([
    ["odd-length", "abc"],
    ["non-hex", "not-hex"],
    ["oversized", "aa".repeat(257)],
  ])("rejects %s ActivityKit tokens before lookup or registration", async (_case, token) => {
    const activityRes = await registerLiveActivityPOST(
      request(
        "/api/live-activities/checkout-return",
        "POST",
        { bookingId: "booking-1", token },
      ),
      routeParams(),
    );
    const startRes = await registerStartTokenPOST(
      request(
        "/api/live-activities/checkout-return/start-token",
        "POST",
        { token },
      ),
      routeParams(),
    );

    expect(activityRes.status).toBe(400);
    expect(startRes.status).toBe(400);
    expect(mocks.bookingFindUnique).not.toHaveBeenCalled();
    expect(mocks.liveTokenUpsert).not.toHaveBeenCalled();
    expect(mocks.startTokenUpsert).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rate limits credential registration before database work", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValueOnce(
      new HttpError(429, "Too many requests"),
    );

    const res = await registerStartTokenPOST(
      request(
        "/api/live-activities/checkout-return/start-token",
        "POST",
        { token: "d4".repeat(32) },
      ),
      routeParams(),
    );

    expect(res.status).toBe(429);
    expect(mocks.startTokenUpsert).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("keeps sign-out revoke-all available without a registration-rate-limit dependency", async () => {
    const res = await revokeStartTokensDELETE(
      request("/api/live-activities/checkout-return/start-token", "DELETE"),
      routeParams(),
    );

    expect(res.status).toBe(200);
    expect(mocks.revokeStartTokens).toHaveBeenCalledWith(user.id);
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });
});
