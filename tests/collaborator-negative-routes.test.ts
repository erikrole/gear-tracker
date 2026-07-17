import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/services/licenses", () => ({
  listAllCodes: vi.fn(),
  listCodes: vi.fn(),
  createCode: vi.fn(),
}));
vi.mock("@/lib/guides", () => ({
  listGuides: vi.fn(),
  createGuide: vi.fn(),
  getGuideAudience: vi.fn(),
}));
vi.mock("@/lib/services/shift-trades", () => ({
  listTrades: vi.fn(),
  postTrade: vi.fn(),
}));
vi.mock("@/lib/services/reports", () => ({
  getUtilizationReport: vi.fn(),
  getUtilizationReportExport: vi.fn(),
}));
vi.mock("@/lib/services/bookings", () => ({
  listBookings: vi.fn(),
  getBookingDetail: vi.fn(),
  updateReservation: vi.fn(),
  updateCheckout: vi.fn(),
}));
vi.mock("@/lib/services/booking-rules", () => ({
  getAllowedBookingActions: vi.fn(),
  requireBookingAction: vi.fn(),
}));
vi.mock("@/lib/services/checkout-policies", () => ({ loadCheckoutPolicies: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditEntry: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { requireAuth } from "@/lib/auth";
import { getBookingDetail } from "@/lib/services/bookings";
import { GET as getUsers } from "@/app/api/users/route";
import { GET as getLicenses } from "@/app/api/licenses/route";
import { GET as getResources } from "@/app/api/resources/route";
import { POST as createShift } from "@/app/api/shifts/route";
import { GET as getTrades } from "@/app/api/shift-trades/route";
import { GET as getUtilization } from "@/app/api/reports/utilization/route";
import { GET as getReservationRules } from "@/app/api/settings/reservation-rules/route";
import { GET as getCheckouts, POST as createCheckout } from "@/app/api/checkouts/route";
import { GET as getBooking } from "@/app/api/bookings/[id]/route";

const collaborator = {
  id: "btn-1",
  email: "trey@example.com",
  name: "Trey",
  role: Role.COLLABORATOR,
  affiliation: "BIG_TEN_NETWORK" as const,
  collaboratorProfile: "BTN_STANDARD" as const,
  avatarUrl: null,
};

function request(path: string, method = "GET") {
  return new Request(`https://app.example.com${path}`, {
    method,
    headers: {
      host: "app.example.com",
      ...(method === "GET" ? {} : { origin: "https://app.example.com" }),
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(collaborator);
});

describe("collaborator default-deny route matrix", () => {
  it.each([
    ["People directory", () => getUsers(request("/api/users"), { params: Promise.resolve({}) })],
    ["licenses", () => getLicenses(request("/api/licenses"), { params: Promise.resolve({}) })],
    ["guides", () => getResources(request("/api/resources"), { params: Promise.resolve({}) })],
    ["shift creation", () => createShift(request("/api/shifts", "POST"), { params: Promise.resolve({}) })],
    ["shift trades", () => getTrades(request("/api/shift-trades"), { params: Promise.resolve({}) })],
    ["reports", () => getUtilization(request("/api/reports/utilization"), { params: Promise.resolve({}) })],
    ["settings", () => getReservationRules(request("/api/settings/reservation-rules"), { params: Promise.resolve({}) })],
    ["checkout list", () => getCheckouts(request("/api/checkouts"), { params: Promise.resolve({}) })],
    ["direct checkout creation", () => createCheckout(request("/api/checkouts", "POST"), { params: Promise.resolve({}) })],
  ])("denies %s", async (_label, invoke) => {
    const response = await invoke();
    expect(response.status).toBe(403);
  });

  it("returns 404 for another user's booking instead of exposing its existence", async () => {
    vi.mocked(getBookingDetail).mockResolvedValue({
      id: "booking-2",
      requesterUserId: "other-user",
      createdBy: "other-user",
    } as unknown as Awaited<ReturnType<typeof getBookingDetail>>);

    const response = await getBooking(request("/api/bookings/booking-2"), {
      params: Promise.resolve({ id: "booking-2" }),
    });

    expect(response.status).toBe(404);
  });
});
