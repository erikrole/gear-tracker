import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  productEvent: {
    create: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));

import { requireAuth } from "@/lib/auth";
import { POST as postProductEvent } from "@/app/api/product-events/route";
import { GET as getUsageReport } from "@/app/api/reports/usage/route";
import { canViewUsageAnalytics, pseudonymousAnalyticsKey } from "@/lib/usage-analytics";

const owner = {
  id: "owner-1", name: "Owner", email: "owner@example.com", role: Role.ADMIN,
  forcePasswordChange: false, avatarUrl: null, affiliation: null, collaboratorProfile: null,
  staffingType: undefined, capabilities: [], collaboratorPolicy: null,
};

function request(path: string, method = "GET", body?: object) {
  return new Request(`https://app.example.com${path}`, {
    method,
    headers: { origin: "https://app.example.com", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.USAGE_ANALYTICS_OWNER_EMAILS = "owner@example.com";
  process.env.USAGE_ANALYTICS_HASH_SECRET = "a-private-test-secret-with-more-than-32-characters";
  vi.mocked(requireAuth).mockResolvedValue(owner);
  dbMock.productEvent.create.mockResolvedValue({ id: "event-1" });
  dbMock.productEvent.count.mockResolvedValue(0);
  dbMock.productEvent.groupBy.mockResolvedValue([]);
});

describe("private usage analytics", () => {
  it("does not grant access from ADMIN role alone", async () => {
    process.env.USAGE_ANALYTICS_OWNER_EMAILS = "someone-else@example.com";
    expect(canViewUsageAnalytics(owner)).toBe(false);
    const response = await getUsageReport(request("/api/reports/usage"), { params: Promise.resolve({}) });
    expect(response.status).toBe(403);
    expect(dbMock.productEvent.count).not.toHaveBeenCalled();
  });

  it("allows only an explicitly configured owner", async () => {
    expect(canViewUsageAnalytics(owner)).toBe(true);
    const response = await getUsageReport(request("/api/reports/usage?days=7"), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
  });

  it("stores only allowlisted, pseudonymous event fields", async () => {
    const response = await postProductEvent(request("/api/product-events", "POST", {
      eventName: "surface_viewed",
      platform: "ios",
      surface: "schedule",
      appVersion: "26.8.12",
      sessionKey: "1234567890abcdef",
    }), { params: Promise.resolve({}) });
    expect(response.status).toBe(202);
    expect(dbMock.productEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      eventName: "surface_viewed",
      platform: "ios",
      surface: "schedule",
    }) });
    expect(JSON.stringify(dbMock.productEvent.create.mock.calls[0])).not.toContain(owner.id);
    expect(pseudonymousAnalyticsKey(owner.id)).not.toBe(owner.id);
  });

  it("rejects free-form properties and record identifiers", async () => {
    const response = await postProductEvent(request("/api/product-events", "POST", {
      eventName: "surface_viewed",
      platform: "web",
      surface: "items",
      properties: { bookingId: "booking-1" },
    }), { params: Promise.resolve({}) });
    expect(response.status).toBe(400);
    expect(dbMock.productEvent.create).not.toHaveBeenCalled();
  });
});
