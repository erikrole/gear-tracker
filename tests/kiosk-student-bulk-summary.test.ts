import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  bookingFindMany: vi.fn(),
  enforceRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    booking: { findMany: mocks.bookingFindMany },
  },
}));

vi.mock("@/lib/api", () => ({
  withKiosk: <P extends Record<string, string>>(
    handler: (req: Request, ctx: {
      params: P;
      kiosk: { kioskId: string; locationId: string; locationName: string };
    }) => Promise<Response>,
  ) => async (req: Request, ctx: { params: Promise<P> }) => handler(req, {
    params: await ctx.params,
    kiosk: { kioskId: "kiosk-1", locationId: "loc-1", locationName: "Camp Randall" },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getClientIp: mocks.getClientIp,
}));

import { GET as getKioskStudent } from "@/app/api/kiosk/student/[userId]/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClientIp.mockReturnValue("203.0.113.10");
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.userFindUnique.mockResolvedValue({
    id: "user-1",
    active: true,
    locationId: "loc-1",
    role: "STUDENT",
    affiliation: null,
    collaboratorProfile: null,
    collaboratorPolicy: null,
  });
});

describe("kiosk student bulk summaries", () => {
  it("keeps a million-unit checkout summary proportional to bulk-family lines", async () => {
    mocks.bookingFindMany
      .mockResolvedValueOnce([{
        id: "checkout-1",
        title: "Supply checkout",
        refNumber: "CO-1001",
        endsAt: new Date("2026-08-01T12:00:00.000Z"),
        serializedItems: [],
        bulkItems: [{
          checkedOutQuantity: 1_000_000,
          plannedQuantity: 1_000_000,
          bulkSku: { name: "Cable Ties" },
        }],
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await getKioskStudent(
      new Request("http://test"),
      { params: Promise.resolve({ userId: "user-1" }) },
    );
    const json = await res.json();

    expect(json.checkouts[0].items).toEqual([{
      name: "Cable Ties x1000000",
      tagName: "x1000000",
    }]);
    expect(json.checkouts[0].items).toHaveLength(1);
  });
});
