import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/bookings", () => ({
  getBookingDetail: vi.fn(),
  extendBooking: vi.fn(),
}));

vi.mock("@/lib/services/booking-rules", () => ({
  getAllowedBookingActions: vi.fn(() => ["extend"]),
  requireBookingAction: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { getBookingDetail, extendBooking } from "@/lib/services/bookings";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { POST } from "@/app/api/bookings/[id]/extend/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

const baseDetail = {
  id: "cm000000000000000000000001",
  kind: "CHECKOUT",
  title: "Camera checkout",
  requesterUserId: "cm000000000000000000000002",
  createdBy: "staff-1",
  locationId: "cm000000000000000000000003",
  startsAt: new Date("2026-06-01T10:00:00.000Z"),
  endsAt: new Date("2026-06-01T12:00:00.000Z"),
  updatedAt: new Date("2026-06-01T09:00:00.500Z"),
};

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://app.example.com/api/bookings/cm000000000000000000000001/extend", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function bookingDetail(row: unknown) {
  return row as Awaited<ReturnType<typeof getBookingDetail>>;
}

function bookingActionResult(row: unknown) {
  return row as Awaited<ReturnType<typeof requireBookingAction>>;
}

function extendResult(row: unknown) {
  return row as Awaited<ReturnType<typeof extendBooking>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
  vi.mocked(getBookingDetail).mockResolvedValue(bookingDetail(baseDetail));
  vi.mocked(requireBookingAction).mockResolvedValue(bookingActionResult(baseDetail));
  vi.mocked(extendBooking).mockResolvedValue(extendResult(baseDetail));
});

describe("booking extend route contract", () => {
  it("rejects extends without an optimistic-lock header", async () => {
    const res = await POST(
      request({ endsAt: "2026-06-01T14:00:00.000Z" }),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(428);
    expect(requireBookingAction).not.toHaveBeenCalled();
    expect(extendBooking).not.toHaveBeenCalled();
  });

  it("rejects a stale snapshot before dispatching the extend service", async () => {
    // Simulates the exact regression this closes: a tab that last saw the
    // booking before someone else's edit tries to extend from stale context.
    const res = await POST(
      request(
        { endsAt: "2026-06-01T14:00:00.000Z" },
        { "if-unmodified-since": "Mon, 01 Jun 2026 08:59:59 GMT" },
      ),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(409);
    expect(requireBookingAction).not.toHaveBeenCalled();
    expect(extendBooking).not.toHaveBeenCalled();
  });

  it("dispatches a fresh-snapshot extend to the service", async () => {
    const res = await POST(
      request(
        { endsAt: "2026-06-01T14:00:00.000Z" },
        { "if-unmodified-since": "Mon, 01 Jun 2026 09:00:00 GMT" },
      ),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(200);
    expect(requireBookingAction).toHaveBeenCalledWith(baseDetail.id, staffUser, "extend");
    expect(extendBooking).toHaveBeenCalledWith(
      baseDetail.id,
      staffUser.id,
      new Date("2026-06-01T14:00:00.000Z"),
    );
  });

  it("rejects an invalid optimistic-lock header", async () => {
    const res = await POST(
      request(
        { endsAt: "2026-06-01T14:00:00.000Z" },
        { "if-unmodified-since": "not-a-date" },
      ),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(400);
    expect(extendBooking).not.toHaveBeenCalled();
  });
});
