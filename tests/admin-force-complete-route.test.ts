import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingKind, Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/booking-rules", () => ({
  requireBookingAction: vi.fn(),
  getAllowedBookingActions: vi.fn(),
}));

vi.mock("@/lib/services/bookings", () => ({
  forceCompleteCheckout: vi.fn(),
  getBookingDetail: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { forceCompleteCheckout, getBookingDetail } from "@/lib/services/bookings";
import { getAllowedBookingActions, requireBookingAction } from "@/lib/services/booking-rules";
import { POST } from "@/app/api/bookings/[id]/force-complete/route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin One",
  role: Role.ADMIN,
  avatarUrl: null,
};

const BOOKING_ID = "cm000000000000000000000001";

function post(body: Record<string, unknown>) {
  return new Request(`https://app.example.com/api/bookings/${BOOKING_ID}/force-complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

function ctx() {
  return { params: Promise.resolve({ id: BOOKING_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(adminUser);
  vi.mocked(requireBookingAction).mockResolvedValue({ id: BOOKING_ID } as Awaited<ReturnType<typeof requireBookingAction>>);
  vi.mocked(forceCompleteCheckout).mockResolvedValue({ success: true });
  vi.mocked(getBookingDetail).mockResolvedValue({
    id: BOOKING_ID,
    kind: BookingKind.CHECKOUT,
    status: "COMPLETED",
    requesterUserId: "student-1",
    createdBy: "admin-1",
  } as Awaited<ReturnType<typeof getBookingDetail>>);
  vi.mocked(getAllowedBookingActions).mockReturnValue([]);
});

describe("admin force-complete route", () => {
  it("requires the checkout force-complete action and closes with a reason", async () => {
    const res = await POST(
      post({ reason: "Scanner offline, all gear verified on shelf." }),
      ctx(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(requireBookingAction).toHaveBeenCalledWith(BOOKING_ID, adminUser, "force-complete", BookingKind.CHECKOUT);
    expect(forceCompleteCheckout).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      actorUserId: adminUser.id,
      reason: "Scanner offline, all gear verified on shelf.",
    });
    expect(body.data.allowedActions).toEqual([]);
  });

  it("rejects missing or too-short reasons before writing", async () => {
    const res = await POST(post({ reason: "too short" }), ctx());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Validation failed");
    expect(requireBookingAction).not.toHaveBeenCalled();
    expect(forceCompleteCheckout).not.toHaveBeenCalled();
  });
});
