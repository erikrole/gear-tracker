import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  bookingUpdate: vi.fn(),
  userFindUnique: vi.fn(),
  createAuditEntry: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    booking: {
      findUnique: mocks.bookingFindUnique,
      update: mocks.bookingUpdate,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

vi.mock("@/lib/api", () => ({
  withKiosk: (handler: any) => (req: Request, ctx: { params: Record<string, string> }) =>
    handler(req, {
      params: ctx.params,
      kiosk: {
        kioskId: "kiosk-1",
        locationId: "loc-1",
        locationName: "Camp Randall",
      },
    }),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: mocks.createAuditEntry,
}));

import { GET as getKioskCheckoutDetail } from "@/app/api/kiosk/checkout/[id]/route";
import { POST as confirmKioskPickup } from "@/app/api/kiosk/pickup/[id]/confirm/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("kiosk checkout detail bulk units", () => {
  it("includes pending pickup battery quantity as scan checklist slots", async () => {
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      title: "Pickup",
      refNumber: "CO-1001",
      status: "PENDING_PICKUP",
      kind: "CHECKOUT",
      endsAt: new Date("2026-05-06T12:00:00.000Z"),
      serializedItems: [],
      bulkItems: [{
        id: "bulk-item-1",
        plannedQuantity: 2,
        checkedOutQuantity: 0,
        checkedInQuantity: 0,
        bulkSku: {
          id: "sku-1",
          name: "Sony Battery",
          category: "Batteries",
          trackByNumber: true,
        },
        unitAllocations: [],
      }],
    });

    const res = await (getKioskCheckoutDetail as any)(new Request("http://test"), {
      params: { id: "booking-1" },
    });
    const json = await res.json();

    expect(json.items).toEqual([
      { id: "bulk-item-1:slot:1", tagName: "#1", name: "Sony Battery 1", returned: false },
      { id: "bulk-item-1:slot:2", tagName: "#2", name: "Sony Battery 2", returned: false },
    ]);
  });

  it("includes checked-out battery units in return detail", async () => {
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      title: "Return",
      refNumber: "CO-1001",
      status: "OPEN",
      kind: "CHECKOUT",
      endsAt: new Date("2026-05-06T12:00:00.000Z"),
      serializedItems: [],
      bulkItems: [{
        id: "bulk-item-1",
        plannedQuantity: 2,
        checkedOutQuantity: 2,
        checkedInQuantity: 1,
        bulkSku: {
          id: "sku-1",
          name: "Sony Battery",
          category: "Batteries",
          trackByNumber: true,
        },
        unitAllocations: [
          {
            checkedInAt: null,
            bulkSkuUnit: { id: "unit-7", unitNumber: 7 },
          },
          {
            checkedInAt: new Date("2026-05-05T12:00:00.000Z"),
            bulkSkuUnit: { id: "unit-11", unitNumber: 11 },
          },
        ],
      }],
    });

    const res = await (getKioskCheckoutDetail as any)(new Request("http://test"), {
      params: { id: "booking-1" },
    });
    const json = await res.json();

    expect(json.items).toEqual([
      { id: "unit-7", tagName: "#7", name: "Sony Battery #7", returned: false },
      { id: "unit-11", tagName: "#11", name: "Sony Battery #11", returned: true },
    ]);
  });
});

describe("kiosk pickup confirm bulk guard", () => {
  it("blocks pickup confirmation until all planned battery units are scanned", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "user-1", name: "User", role: "STUDENT" });
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      status: "PENDING_PICKUP",
      kind: "CHECKOUT",
      title: "Pickup",
      serializedItems: [],
      bulkItems: [{
        plannedQuantity: 3,
        checkedOutQuantity: 2,
        bulkSku: { name: "Sony Battery" },
      }],
    });

    await expect((confirmKioskPickup as any)(new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ actorId: "user-1" }),
    }), {
      params: { id: "booking-1" },
    })).rejects.toThrow("Scan all Sony Battery units before confirming pickup");

    expect(mocks.bookingUpdate).not.toHaveBeenCalled();
  });
});
