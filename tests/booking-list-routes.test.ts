import { beforeEach, describe, expect, it, vi } from "vitest";
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
}));

import { requireAuth } from "@/lib/auth";
import { listBookings } from "@/lib/services/bookings";
import { GET as getReservations } from "@/app/api/reservations/route";

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
});
