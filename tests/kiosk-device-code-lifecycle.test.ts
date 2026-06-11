import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  kioskDeviceFindUnique: vi.fn(),
  kioskDeviceUpdate: vi.fn(),
  requirePermission: vi.fn(),
  enforceRateLimit: vi.fn(),
  createAuditEntry: vi.fn(),
  tokenHash: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    kioskDevice: {
      findUnique: mocks.kioskDeviceFindUnique,
      update: mocks.kioskDeviceUpdate,
    },
  },
}));

vi.mock("@/lib/api", () => ({
  withAuth: (handler: any) => async (req: Request, ctx: { params: { id: string } }) => {
    try {
      return await handler(req, {
        params: ctx.params,
        user: { id: "admin-1", role: "ADMIN" },
      });
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error
        ? Number((error as { status: unknown }).status)
        : 500;
      const message = error instanceof Error ? error.message : "Internal server error";
      return Response.json({ error: message }, { status });
    }
  },
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/rate-limit", () => ({
  SETTINGS_MUTATION_LIMIT: { max: 10, windowMs: 60_000 },
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: mocks.createAuditEntry,
}));

vi.mock("@/lib/auth", () => ({
  tokenHash: mocks.tokenHash,
}));

import { PATCH as patchKioskDevice } from "@/app/api/kiosk-devices/[id]/route";
import { POST as regenerateKioskCode } from "@/app/api/kiosk-devices/[id]/regenerate-code/route";

function jsonRequest(body: unknown) {
  return new Request("http://test/api/kiosk-devices/device-1", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const activatedAt = new Date("2026-06-01T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
    (array as Uint32Array)[0] = 123456;
    return array;
  });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.tokenHash.mockImplementation(async (value: string) => `hash:${value}`);
  mocks.createAuditEntry.mockResolvedValue(undefined);
  mocks.kioskDeviceUpdate.mockResolvedValue({
    id: "device-1",
    name: "Kiosk 1",
    locationId: "loc-1",
    location: { id: "loc-1", name: "Camp Randall" },
    active: false,
    activatedAt: null,
    lastSeenAt: null,
    createdAt: new Date("2026-05-01T12:00:00.000Z"),
  });
});

describe("kiosk device activation code lifecycle", () => {
  it("blocks regenerate while an activated device is still active", async () => {
    mocks.kioskDeviceFindUnique.mockResolvedValue({
      id: "device-1",
      name: "Kiosk 1",
      active: true,
      activatedAt,
    });

    const res = await (regenerateKioskCode as any)(jsonRequest({}), {
      params: { id: "device-1" },
    });
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("Deactivate this kiosk before regenerating its code.");
    expect(mocks.kioskDeviceUpdate).not.toHaveBeenCalled();
  });

  it("regenerates a code for a deactivated but previously activated device", async () => {
    mocks.kioskDeviceFindUnique.mockResolvedValue({
      id: "device-1",
      name: "Kiosk 1",
      active: false,
      activatedAt,
    });

    const res = await (regenerateKioskCode as any)(jsonRequest({}), {
      params: { id: "device-1" },
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      id: "device-1",
      name: "Kiosk 1",
      activationCode: "223456",
    });
    expect(mocks.kioskDeviceUpdate).toHaveBeenCalledWith({
      where: { id: "device-1" },
      data: {
        activationCode: "hash:223456",
        activatedAt: null,
        sessionToken: null,
        sessionExpiresAt: null,
      },
    });
  });

  it("preserves regeneration for never-activated devices", async () => {
    mocks.kioskDeviceFindUnique.mockResolvedValue({
      id: "device-1",
      name: "Kiosk 1",
      active: true,
      activatedAt: null,
    });

    const res = await (regenerateKioskCode as any)(jsonRequest({}), {
      params: { id: "device-1" },
    });

    expect(res.status).toBe(200);
    expect(mocks.kioskDeviceUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        activationCode: "hash:223456",
        activatedAt: null,
      }),
    }));
  });

  it("clears activation state when deactivating a device", async () => {
    mocks.kioskDeviceFindUnique.mockResolvedValue({
      id: "device-1",
      name: "Kiosk 1",
      active: true,
      activatedAt,
    });

    const res = await (patchKioskDevice as any)(jsonRequest({ active: false }), {
      params: { id: "device-1" },
    });

    expect(res.status).toBe(200);
    expect(mocks.kioskDeviceUpdate).toHaveBeenCalledWith({
      where: { id: "device-1" },
      data: {
        active: false,
        sessionToken: null,
        sessionExpiresAt: null,
        activatedAt: null,
      },
      include: {
        location: { select: { id: true, name: true } },
      },
    });
  });
});
