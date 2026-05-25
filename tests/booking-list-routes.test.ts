import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { BookingKind, BookingStatus } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/bookings", () => ({
  createBooking: vi.fn(),
  listBookings: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@/lib/services/notifications", () => ({
  createReservationLifecycleNotification: vi.fn(),
  notifyLowStock: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { createBooking, listBookings } from "@/lib/services/bookings";
import { POST as postCheckouts } from "@/app/api/checkouts/route";
import { GET as getReservations, POST as postReservations } from "@/app/api/reservations/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin One",
  role: "ADMIN" as any,
  avatarUrl: null,
};

const studentUser = {
  id: "student-1",
  email: "student@example.com",
  name: "Student One",
  role: "STUDENT" as any,
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(adminUser);
  vi.mocked(listBookings).mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 } as never);
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

  it("rejects malformed checkout create JSON before creating a booking", async () => {
    const res = await postCheckouts(
      malformedPost("/api/checkouts"),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Request body must be valid JSON");
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
});
