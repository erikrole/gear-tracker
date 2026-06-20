import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/bookings", () => ({
  getBookingDetail: vi.fn(),
  updateReservation: vi.fn(),
  updateCheckout: vi.fn(),
}));

vi.mock("@/lib/services/booking-rules", () => ({
  getAllowedBookingActions: vi.fn(() => ["edit"]),
  requireBookingAction: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { getBookingDetail, updateCheckout, updateReservation } from "@/lib/services/bookings";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { PATCH } from "@/app/api/bookings/[id]/route";

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
  serializedItems: [{ assetId: "cm000000000000000000000004" }],
  bulkItems: [{ bulkSkuId: "cm000000000000000000000005", plannedQuantity: 2 }],
  notes: "Original notes",
};

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://app.example.com/api/bookings/cm000000000000000000000001", {
    method: "PATCH",
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

function checkoutUpdateResult(row: unknown) {
  return row as Awaited<ReturnType<typeof updateCheckout>>;
}

function reservationUpdateResult(row: unknown) {
  return row as Awaited<ReturnType<typeof updateReservation>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
  vi.mocked(getBookingDetail).mockResolvedValue(bookingDetail(baseDetail));
  vi.mocked(requireBookingAction).mockResolvedValue(bookingActionResult(baseDetail));
  vi.mocked(updateCheckout).mockResolvedValue(checkoutUpdateResult(baseDetail));
  vi.mocked(updateReservation).mockResolvedValue(reservationUpdateResult({ ...baseDetail, kind: "RESERVATION" }));
});

describe("booking lifecycle route contract", () => {
  it("rejects edits without an optimistic-lock header", async () => {
    const res = await PATCH(
      request({ title: "Updated checkout" }),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(428);
    expect(requireBookingAction).not.toHaveBeenCalled();
    expect(updateCheckout).not.toHaveBeenCalled();
  });

  it("rejects stale edit snapshots before dispatching update services", async () => {
    const res = await PATCH(
      request(
        { title: "Updated checkout" },
        { "if-unmodified-since": "Mon, 01 Jun 2026 08:59:59 GMT" },
      ),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(409);
    expect(updateCheckout).not.toHaveBeenCalled();
    expect(updateReservation).not.toHaveBeenCalled();
  });

  it("dispatches checkout edits to updateCheckout and records a full before snapshot", async () => {
    const res = await PATCH(
      request(
        {
          title: "Updated checkout",
          endsAt: "2026-06-01T13:00:00.000Z",
          notes: "Updated notes",
        },
        { "if-unmodified-since": "Mon, 01 Jun 2026 09:00:00 GMT" },
      ),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(200);
    expect(updateCheckout).toHaveBeenCalledWith(baseDetail.id, staffUser.id, {
      title: "Updated checkout",
      endsAt: new Date("2026-06-01T13:00:00.000Z"),
      serializedAssetIds: undefined,
      bulkItems: undefined,
      notes: "Updated notes",
    });
    expect(updateReservation).not.toHaveBeenCalled();
    expect(createAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        before: expect.objectContaining({
          title: "Camera checkout",
          serializedAssetIds: ["cm000000000000000000000004"],
          bulkItems: [{ bulkSkuId: "cm000000000000000000000005", plannedQuantity: 2 }],
          notes: "Original notes",
        }),
      }),
    );
  });

  it("dispatches reservation edits to updateReservation", async () => {
    vi.mocked(getBookingDetail).mockResolvedValue(bookingDetail({ ...baseDetail, kind: "RESERVATION" }));

    const res = await PATCH(
      request(
        {
          title: "Updated reservation",
          requesterUserId: "cm000000000000000000000006",
          locationId: "cm000000000000000000000007",
          startsAt: "2026-06-01T11:00:00.000Z",
          endsAt: "2026-06-01T13:00:00.000Z",
        },
        { "if-unmodified-since": "Mon, 01 Jun 2026 09:00:00 GMT" },
      ),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(200);
    expect(updateReservation).toHaveBeenCalledWith(baseDetail.id, staffUser.id, {
      title: "Updated reservation",
      requesterUserId: "cm000000000000000000000006",
      locationId: "cm000000000000000000000007",
      startsAt: new Date("2026-06-01T11:00:00.000Z"),
      endsAt: new Date("2026-06-01T13:00:00.000Z"),
      serializedAssetIds: undefined,
      bulkItems: undefined,
      notes: undefined,
    });
    expect(updateCheckout).not.toHaveBeenCalled();
  });
});
