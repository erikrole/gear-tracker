import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    location: { findMany: vi.fn() },
    department: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    bulkSku: { findMany: vi.fn() },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GET as getFormOptions } from "@/app/api/form-options/route";

const noParams = { params: Promise.resolve({}) };

function makeGetRequest(path: string) {
  return new Request(`https://app.example.com${path}`, {
    method: "GET",
    headers: { host: "app.example.com" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue({
    id: "staff-1",
    name: "Staff",
    email: "staff@example.com",
    role: "STAFF",
  } as any);
  vi.mocked(db.location.findMany).mockResolvedValue([]);
  vi.mocked(db.department.findMany).mockResolvedValue([]);
  vi.mocked(db.user.findMany).mockResolvedValue([]);
});

describe("form-options bulk count freshness", () => {
  it("returns no-store picker options with live bulk count semantics", async () => {
    vi.mocked(db.bulkSku.findMany).mockResolvedValue([
      {
        id: "sku-units",
        name: "Sony Battery",
        category: "Batteries",
        unit: "count",
        locationId: "loc-1",
        binQrCodeValue: "sony-battery",
        trackByNumber: true,
        minThreshold: 10,
        categoryRel: { name: "Batteries" },
        balances: [{ onHandQuantity: 99 }],
        units: [{ id: "unit-1" }, { id: "unit-2" }],
      },
      {
        id: "sku-qty",
        name: "AA Batteries",
        category: "Batteries",
        unit: "count",
        locationId: "loc-1",
        binQrCodeValue: "aa-batteries",
        trackByNumber: false,
        minThreshold: 4,
        categoryRel: { name: "Batteries" },
        balances: [{ onHandQuantity: 7 }],
        units: [],
      },
    ] as any);

    const res = await getFormOptions(makeGetRequest("/api/form-options"), noParams);
    const body = await res.json();

    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body.data.bulkSkus).toEqual([
      expect.objectContaining({
        id: "sku-units",
        currentQuantity: 99,
        availableQuantity: 2,
        trackByNumber: true,
      }),
      expect.objectContaining({
        id: "sku-qty",
        currentQuantity: 7,
        availableQuantity: 7,
        trackByNumber: false,
      }),
    ]);
  });
});
