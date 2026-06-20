import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/booking-rules", () => ({
  requireBookingAction: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { POST as checkinItems } from "@/app/api/checkouts/[id]/checkin-items/route";
import { POST as checkinBulk } from "@/app/api/checkouts/[id]/checkin-bulk/route";
import { POST as completeCheckin } from "@/app/api/checkouts/[id]/complete-checkin/route";
import { POST as completeCheckout } from "@/app/api/checkouts/[id]/complete-checkout/route";
import { POST as startScanSession } from "@/app/api/checkouts/[id]/start-scan-session/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

function bookingAction(row: unknown) {
  return row as Awaited<ReturnType<typeof requireBookingAction>>;
}

const BOOKING_ID = "cm000000000000000000000001";

function post(path: string, body: Record<string, unknown> = {}) {
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

function ctx() {
  return { params: Promise.resolve({ id: BOOKING_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
  vi.mocked(requireBookingAction).mockResolvedValue(bookingAction({ id: BOOKING_ID }));
});

describe("kiosk-only custody route boundary", () => {
  it("blocks app/web serialized item returns", async () => {
    const res = await checkinItems(
      post(`/api/checkouts/${BOOKING_ID}/checkin-items`, {
        assetIds: ["cm000000000000000000000002"],
      }),
      ctx(),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Return gear at a kiosk. App/web cannot complete checkout returns.");
    expect(requireBookingAction).toHaveBeenCalledWith(BOOKING_ID, staffUser, "view", "CHECKOUT");
  });

  it("blocks app/web bulk item returns", async () => {
    const res = await checkinBulk(
      post(`/api/checkouts/${BOOKING_ID}/checkin-bulk`, {
        bulkItemId: "cm000000000000000000000002",
        quantity: 1,
      }),
      ctx(),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Return gear at a kiosk. App/web cannot complete checkout returns.");
    expect(requireBookingAction).toHaveBeenCalledWith(BOOKING_ID, staffUser, "view", "CHECKOUT");
  });

  it("blocks app/web check-in completion", async () => {
    const res = await completeCheckin(post(`/api/checkouts/${BOOKING_ID}/complete-checkin`), ctx());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Return gear at a kiosk. App/web cannot complete checkout returns.");
    expect(requireBookingAction).toHaveBeenCalledWith(BOOKING_ID, staffUser, "view", "CHECKOUT");
  });

  it("blocks app/web checkout pickup completion", async () => {
    const res = await completeCheckout(post(`/api/checkouts/${BOOKING_ID}/complete-checkout`), ctx());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Pick up gear at a kiosk. App/web cannot complete checkout custody.");
  });

  it("blocks app/web custody scan sessions", async () => {
    const res = await startScanSession(
      post(`/api/checkouts/${BOOKING_ID}/start-scan-session`, { phase: "CHECKIN" }),
      ctx(),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Custody scan sessions must be started at a kiosk.");
  });
});
