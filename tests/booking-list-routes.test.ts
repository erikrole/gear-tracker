import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { BookingKind, BookingStatus, Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/bookings", () => ({
  createBooking: vi.fn(),
  listBookings: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    booking: {
      count: vi.fn(),
    },
    bulkStockBalance: {
      findMany: vi.fn(),
    },
    bulkSku: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@/lib/services/notifications", () => ({
  createReservationLifecycleNotification: vi.fn(),
  notifyLowStock: vi.fn(),
}));

vi.mock("@/lib/services/checkout-policies", () => ({
  loadCheckoutPolicies: vi.fn(),
}));

vi.mock("@/lib/services/event-defaults", () => ({
  resolveEventDefaults: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createBooking, listBookings } from "@/lib/services/bookings";
import { loadCheckoutPolicies } from "@/lib/services/checkout-policies";
import { resolveEventDefaults } from "@/lib/services/event-defaults";
import { POST as postCheckouts } from "@/app/api/checkouts/route";
import { GET as getReservations, POST as postReservations } from "@/app/api/reservations/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin One",
  role: Role.ADMIN,
  avatarUrl: null,
};

const studentUser = {
  id: "student-1",
  email: "student@example.com",
  name: "Student One",
  role: Role.STUDENT,
  avatarUrl: null,
};

function get(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

function malformedPost(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: "{not-json",
  });
}

function post(path: string, body: Record<string, unknown>) {
  return new Request(`https://app.example.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(adminUser);
  vi.mocked(listBookings).mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 } as never);
  vi.mocked(loadCheckoutPolicies).mockResolvedValue({
    defaultLoanDays: 2,
    gracePeriodHours: 1,
    maxItemsPerUser: null,
  });
  vi.mocked(db.booking.count).mockResolvedValue(0);
  vi.mocked(createBooking).mockResolvedValue({ id: "booking-1", title: "Event kit", bulkItems: [] } as never);
});

describe("booking list routes", () => {
  it("maps reservation overdue links to booked reservations past their end time", async () => {
    const res = await getReservations(
      get("/api/reservations?filter=overdue"),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(listBookings).toHaveBeenCalledWith(
      BookingKind.RESERVATION,
      expect.any(URLSearchParams),
      expect.objectContaining({
        status: BookingStatus.BOOKED,
        endsAt: expect.objectContaining({ lt: expect.any(Date) }),
      }),
      undefined,
    );
  });

  it("maps reservation due-today links to booked reservations ending today", async () => {
    const res = await getReservations(
      get("/api/reservations?filter=due-today"),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(listBookings).toHaveBeenCalledWith(
      BookingKind.RESERVATION,
      expect.any(URLSearchParams),
      expect.objectContaining({
        status: BookingStatus.BOOKED,
        endsAt: expect.objectContaining({
          gte: expect.any(Date),
          lt: expect.any(Date),
        }),
      }),
      undefined,
    );
  });

  it("keeps report overdue drill-down links on the special filter parameter", () => {
    const checkoutsReport = readFileSync("src/app/(app)/reports/checkouts/page.tsx", "utf8");
    const overdueReport = readFileSync("src/app/(app)/reports/overdue/page.tsx", "utf8");

    expect(checkoutsReport).toContain('href="/checkouts?filter=overdue"');
    expect(overdueReport).toContain('href="/checkouts?filter=overdue"');
    expect(checkoutsReport).not.toContain("status=overdue");
    expect(overdueReport).not.toContain("status=overdue");
  });

  it("keeps student reservation list scope pinned to the student while applying special filters", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await getReservations(
      get("/api/reservations?filter=overdue&requester_id=admin-1"),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(listBookings).toHaveBeenCalledWith(
      BookingKind.RESERVATION,
      expect.any(URLSearchParams),
      expect.objectContaining({
        status: BookingStatus.BOOKED,
        endsAt: expect.objectContaining({ lt: expect.any(Date) }),
      }),
      "student-1",
    );
  });

  it("blocks app/web checkout creation before creating a booking", async () => {
    const res = await postCheckouts(
      malformedPost("/api/checkouts"),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Create a reservation in app/web. Direct checkout is only available at a kiosk.");
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("rejects malformed reservation create JSON before creating a booking", async () => {
    const res = await postReservations(
      malformedPost("/api/reservations"),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
    expect(createBooking).not.toHaveBeenCalled();
  });

  it("does not run checkout event-default or create logic for app/web checkout POST", async () => {
    const res = await postCheckouts(
      post("/api/checkouts", {
        title: "Event kit",
        requesterUserId: "cm000000000000000000000001",
        locationId: "cm000000000000000000000002",
        startsAt: "2026-07-01T12:00:00.000Z",
        endsAt: "2026-07-01T18:00:00.000Z",
        serializedAssetIds: ["cm000000000000000000000003"],
        eventIds: [
          "cm000000000000000000000004",
          "cm000000000000000000000005",
        ],
        sportCode: "MBB",
      }),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Create a reservation in app/web. Direct checkout is only available at a kiosk.");
    expect(resolveEventDefaults).not.toHaveBeenCalled();
    expect(createBooking).not.toHaveBeenCalled();
  });
});
