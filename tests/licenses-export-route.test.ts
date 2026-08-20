import { beforeEach, describe, expect, it, vi } from "vitest";
import { LicenseCodeStatus, Role } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  createAuditEntry: vi.fn(),
  listAllCodes: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditEntry: mocks.createAuditEntry }));
vi.mock("@/lib/services/licenses", () => ({ listAllCodes: mocks.listAllCodes }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { requireAuth } from "@/lib/auth";
import { GET as exportLicenses } from "@/app/api/licenses/export/route";

const user = {
  id: "staff-1",
  name: "Staff One",
  email: "staff@example.com",
  role: Role.STAFF,
  avatarUrl: null,
  forcePasswordChange: false,
};

function request() {
  return new Request("https://app.example.com/api/licenses/export", {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(user);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  mocks.createAuditEntry.mockResolvedValue(undefined);
  mocks.listAllCodes.mockResolvedValue([
    {
      id: "code-1",
      code: "PM-SECRET-ONE",
      label: "Editing Bay",
      accountEmail: "photo@example.com",
      status: LicenseCodeStatus.PARTIAL,
      expiresAt: new Date("2027-08-19T00:00:00.000Z"),
      createdAt: new Date("2026-08-01T12:00:00.000Z"),
      claims: [{ user: { name: "Holder One" }, occupantLabel: null }],
    },
    {
      id: "code-2",
      code: "PM-SECRET-TWO",
      label: null,
      accountEmail: null,
      status: LicenseCodeStatus.AVAILABLE,
      expiresAt: null,
      createdAt: new Date("2026-08-02T12:00:00.000Z"),
      claims: [],
    },
  ]);
});

describe("GET /api/licenses/export", () => {
  it("returns a private no-store CSV and audits only safe aggregate metadata", async () => {
    const response = await exportLicenses(request(), { params: Promise.resolve({}) });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(body).toContain("PM-SECRET-ONE");
    expect(body).toContain("photo@example.com");
    expect(body).toContain("Holder One");
    expect(mocks.createAuditEntry).toHaveBeenCalledWith({
      actorId: "staff-1",
      actorRole: Role.STAFF,
      entityType: "license_code",
      entityId: "all",
      action: "export",
      after: { rowCount: 2 },
    });

    const auditPayload = JSON.stringify(mocks.createAuditEntry.mock.calls[0]?.[0]);
    expect(auditPayload).not.toContain("PM-SECRET-ONE");
    expect(auditPayload).not.toContain("photo@example.com");
    expect(auditPayload).not.toContain("Holder One");
  });

  it("does not return the sensitive export when its audit write fails", async () => {
    mocks.createAuditEntry.mockRejectedValueOnce(new Error("audit unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const response = await exportLicenses(request(), { params: Promise.resolve({}) });

      expect(response.status).toBe(500);
      expect(response.headers.get("content-disposition")).toBeNull();
      expect(await response.json()).toEqual({ error: "Internal server error" });
    } finally {
      consoleError.mockRestore();
    }
  });
});
