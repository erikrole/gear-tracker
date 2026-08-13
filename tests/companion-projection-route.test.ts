import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbModuleLoaded: false,
  requireCompanion: vi.fn(),
  readCompanionProjection: vi.fn(),
  registerCompanionDevice: vi.fn(),
  revokeCompanionSession: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  mocks.dbModuleLoaded = true;
  return { db: {} };
});

vi.mock("@/lib/companion-store", () => ({
  requireCompanion: mocks.requireCompanion,
  readCompanionProjection: mocks.readCompanionProjection,
  registerCompanionDevice: mocks.registerCompanionDevice,
  revokeCompanionSession: mocks.revokeCompanionSession,
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getClientIp: () => "127.0.0.1",
}));

import { GET } from "@/app/api/companion/projection/route";
import { DELETE, POST } from "@/app/api/companion/devices/route";

describe("companion projection GET route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCompanion.mockResolvedValue({ role: "STAFF" });
    mocks.readCompanionProjection.mockResolvedValue({
      version: 1,
      revision: 1,
      generatedAt: "2026-08-12T12:00:00.000Z",
      stats: { checkedOut: 0, overdue: 0, reserved: 0, dueToday: 0 },
      pendingPickupTotal: 0,
      openBookings: [],
      bookingActivity: [],
      kioskDevices: [{ id: "kiosk-1" }],
    });
  });

  it("serves the Upstash projection without loading the database module", async () => {
    const response = await GET(
      new Request("https://wisconsincreative.com/api/companion/projection"),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { kioskAccess: "restricted", kioskDevices: [] },
    });
    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.requireCompanion).toHaveBeenCalledTimes(1);
    expect(mocks.dbModuleLoaded).toBe(false);
  });

  it("registers and revokes devices without loading the database module", async () => {
    const postResponse = await POST(
      new Request("https://wisconsincreative.com/api/companion/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "aabbccdd" }),
      }),
      { params: Promise.resolve({}) },
    );
    const deleteResponse = await DELETE(
      new Request("https://wisconsincreative.com/api/companion/devices", { method: "DELETE" }),
      { params: Promise.resolve({}) },
    );

    expect(postResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(mocks.registerCompanionDevice).toHaveBeenCalledWith(
      expect.objectContaining({ role: "STAFF" }),
      "aabbccdd",
    );
    expect(mocks.revokeCompanionSession).toHaveBeenCalledTimes(1);
    expect(mocks.dbModuleLoaded).toBe(false);
  });

  it("keeps the real external-only dependency graph database-free", async () => {
    await vi.importActual("@/lib/companion-store");
    await vi.importActual("@/lib/rate-limit");
    await vi.importActual("@/lib/api-handler");

    expect(mocks.dbModuleLoaded).toBe(false);
  });
});
