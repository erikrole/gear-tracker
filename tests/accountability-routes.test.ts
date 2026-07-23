import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/services/accountability", () => ({
  getCurrentAcademicYearStart: vi.fn(() => 2026),
  getAccountabilityReport: vi.fn(),
  excludeBookingFromAccountability: vi.fn(),
  restoreBookingToAccountability: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
  REPORT_EXPORT_LIMIT: { max: 10, windowMs: 60_000 },
  SETTINGS_MUTATION_LIMIT: { max: 10, windowMs: 60_000 },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { requireAuth } from "@/lib/auth";
import {
  excludeBookingFromAccountability,
  getAccountabilityReport,
  restoreBookingToAccountability,
} from "@/lib/services/accountability";
import { GET } from "@/app/api/accountability/route";
import { POST } from "@/app/api/accountability/exclusions/route";
import { DELETE } from "@/app/api/accountability/exclusions/[bookingId]/route";

const admin = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  role: Role.ADMIN,
  avatarUrl: null,
};
const staff = { ...admin, id: "staff-1", role: Role.STAFF };
const noParams = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(admin);
  vi.mocked(getAccountabilityReport).mockResolvedValue({
    academicYear: { startYear: 2026, label: "2026-27" },
    methodology: {},
    metrics: {},
    locations: [],
    leaderboard: [],
    excluded: [],
  } as never);
});

describe("accountability routes", () => {
  it("serves the report to ADMIN with normalized filters", async () => {
    const response = await GET(
      new Request("https://app.example.com/api/accountability?year=2025&state=resolved&users=inactive"),
      noParams,
    );
    expect(response.status).toBe(200);
    expect(getAccountabilityReport).toHaveBeenCalledWith({
      startYear: 2025,
      locationId: undefined,
      incidentState: "resolved",
      userState: "inactive",
    });
  });

  it("denies report access to STAFF", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staff);
    const response = await GET(
      new Request("https://app.example.com/api/accountability"),
      noParams,
    );
    expect(response.status).toBe(403);
    expect(getAccountabilityReport).not.toHaveBeenCalled();
  });

  it("creates and restores exclusions with ADMIN identity", async () => {
    vi.mocked(excludeBookingFromAccountability).mockResolvedValue({ id: "ex-1" } as never);
    const postResponse = await POST(
      new Request("https://app.example.com/api/accountability/exclusions", {
        method: "POST",
        headers: {
          origin: "https://app.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ bookingId: "booking-1", reason: "TEST_DATA" }),
      }),
      noParams,
    );
    expect(postResponse.status).toBe(201);
    expect(excludeBookingFromAccountability).toHaveBeenCalledWith({
      bookingId: "booking-1",
      reason: "TEST_DATA",
      actorId: "admin-1",
      actorRole: Role.ADMIN,
    });

    vi.mocked(restoreBookingToAccountability).mockResolvedValue({ id: "ex-1" } as never);
    const deleteResponse = await DELETE(
      new Request("https://app.example.com/api/accountability/exclusions/booking-1", {
        method: "DELETE",
        headers: { origin: "https://app.example.com" },
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );
    expect(deleteResponse.status).toBe(200);
    expect(restoreBookingToAccountability).toHaveBeenCalledWith({
      bookingId: "booking-1",
      actorId: "admin-1",
      actorRole: Role.ADMIN,
    });
  });

  it("requires an explanation for Other", async () => {
    const response = await POST(
      new Request("https://app.example.com/api/accountability/exclusions", {
        method: "POST",
        headers: {
          origin: "https://app.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ bookingId: "booking-1", reason: "OTHER" }),
      }),
      noParams,
    );
    expect(response.status).toBe(400);
    expect(excludeBookingFromAccountability).not.toHaveBeenCalled();
  });
});
