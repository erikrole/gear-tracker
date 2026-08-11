import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { POST } from "@/app/api/audit/last/route";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

const noParams = { params: Promise.resolve({}) };
const admin = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  role: "ADMIN" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};
const staff = { ...admin, id: "staff-1", role: "STAFF" as const };

function request(entityType: string, entityIds: string[]) {
  return new Request("https://app.example.com/api/audit/last", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://app.example.com",
    },
    body: JSON.stringify({ entityType, entityIds }),
  });
}

describe("POST /api/audit/last", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(admin);
    vi.mocked(enforceRateLimit).mockResolvedValue(undefined);
    vi.mocked(db.auditLog.groupBy).mockResolvedValue([] as never);
    vi.mocked(db.auditLog.findMany).mockResolvedValue([] as never);
  });

  it("resolves up to 200 entity IDs with two bounded database queries", async () => {
    const assetTime = new Date("2026-08-10T14:00:00.000Z");
    const bookingTime = new Date("2026-08-10T13:00:00.000Z");
    vi.mocked(db.auditLog.groupBy).mockResolvedValue([
      { entityId: "asset-1", _max: { createdAt: assetTime } },
      { entityId: "asset-2", _max: { createdAt: bookingTime } },
    ] as never);
    vi.mocked(db.auditLog.findMany).mockResolvedValue([
      {
        entityId: "asset-1",
        action: "asset_updated_newer_tie",
        createdAt: assetTime,
        actor: { id: "admin-1", name: "Admin" },
      },
      {
        entityId: "asset-1",
        action: "asset_updated_older_tie",
        createdAt: assetTime,
        actor: { id: "staff-1", name: "Staff" },
      },
      {
        entityId: "asset-2",
        action: "asset_created",
        createdAt: bookingTime,
        actor: null,
      },
    ] as never);

    const response = await POST(request("asset", ["asset-1", "asset-2", "asset-1"]), noParams);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        "asset-1": {
          action: "asset_updated_newer_tie",
          createdAt: assetTime.toISOString(),
          actor: { id: "admin-1", name: "Admin" },
        },
        "asset-2": {
          action: "asset_created",
          createdAt: bookingTime.toISOString(),
          actor: null,
        },
      },
    });
    expect(db.auditLog.groupBy).toHaveBeenCalledTimes(1);
    expect(db.auditLog.groupBy).toHaveBeenCalledWith({
      by: ["entityId"],
      where: {
        entityType: "asset",
        entityId: { in: ["asset-1", "asset-2"] },
      },
      _max: { createdAt: true },
    });
    expect(db.auditLog.findMany).toHaveBeenCalledTimes(1);
    expect(db.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }));
  });

  it("skips the row fetch when no requested entity has audit history", async () => {
    const response = await POST(request("asset", ["asset-1"]), noParams);

    await expect(response.json()).resolves.toEqual({ data: {} });
    expect(db.auditLog.groupBy).toHaveBeenCalledTimes(1);
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });

  it("does not let staff probe sensitive audit entity types", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staff);

    const response = await POST(request("session", ["session-1"]), noParams);

    await expect(response.json()).resolves.toEqual({ data: {} });
    expect(db.auditLog.groupBy).not.toHaveBeenCalled();
    expect(db.auditLog.findMany).not.toHaveBeenCalled();
  });
});
