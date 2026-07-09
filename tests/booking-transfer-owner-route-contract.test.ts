import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/bookings", () => ({
  getBookingDetail: vi.fn(),
  transferBookingOwner: vi.fn(),
}));

vi.mock("@/lib/services/booking-rules", () => ({
  getAllowedBookingActions: vi.fn(() => ["edit", "transfer-owner"]),
  requireBookingAction: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { getBookingDetail, transferBookingOwner } from "@/lib/services/bookings";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { POST } from "@/app/api/bookings/[id]/transfer-owner/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

const baseDetail = {
  id: "cm000000000000000000000001",
  kind: "RESERVATION",
  title: "FB MEDIA DAYS",
  requesterUserId: "cm000000000000000000000002",
  createdBy: "staff-1",
  locationId: "cm000000000000000000000003",
  startsAt: new Date("2026-07-20T10:00:00.000Z"),
  endsAt: new Date("2026-07-20T12:00:00.000Z"),
  updatedAt: new Date("2026-07-09T16:00:00.500Z"),
};

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request(`${"https://app.example.com"}/api/bookings/${baseDetail.id}/transfer-owner`, {
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

function transferResult(row: unknown) {
  return row as Awaited<ReturnType<typeof transferBookingOwner>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
  vi.mocked(getBookingDetail).mockResolvedValue(bookingDetail(baseDetail));
  vi.mocked(requireBookingAction).mockResolvedValue(bookingActionResult(baseDetail));
  vi.mocked(transferBookingOwner).mockResolvedValue(transferResult(baseDetail));
});

describe("booking transfer-owner route contract", () => {
  it("requires an optimistic-lock header", async () => {
    const res = await POST(
      request({ targetUserId: "cm000000000000000000000004" }),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(428);
    expect(requireBookingAction).not.toHaveBeenCalled();
    expect(transferBookingOwner).not.toHaveBeenCalled();
  });

  it("rejects a stale snapshot before dispatching the transfer service", async () => {
    const res = await POST(
      request(
        { targetUserId: "cm000000000000000000000004" },
        { "if-unmodified-since": "Thu, 09 Jul 2026 15:59:59 GMT" },
      ),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(409);
    expect(requireBookingAction).not.toHaveBeenCalled();
    expect(transferBookingOwner).not.toHaveBeenCalled();
  });

  it("dispatches a fresh transfer to the service", async () => {
    const res = await POST(
      request(
        {
          targetUserId: "cm000000000000000000000004",
          reason: "FB MEDIA DAYS booking should sit with the operator running it.",
        },
        { "if-unmodified-since": "Thu, 09 Jul 2026 16:00:00 GMT" },
      ),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(200);
    expect(requireBookingAction).toHaveBeenCalledWith(baseDetail.id, staffUser, "transfer-owner");
    expect(transferBookingOwner).toHaveBeenCalledWith(
      baseDetail.id,
      staffUser.id,
      {
        targetUserId: "cm000000000000000000000004",
        reason: "FB MEDIA DAYS booking should sit with the operator running it.",
      },
    );
  });

  it("rejects an invalid optimistic-lock header", async () => {
    const res = await POST(
      request(
        { targetUserId: "cm000000000000000000000004" },
        { "if-unmodified-since": "not-a-date" },
      ),
      { params: Promise.resolve({ id: baseDetail.id }) },
    );

    expect(res.status).toBe(400);
    expect(transferBookingOwner).not.toHaveBeenCalled();
  });
});
