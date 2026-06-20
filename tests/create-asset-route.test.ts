import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    asset: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@/lib/services/status", () => ({
  buildDerivedStatusWhere: vi.fn(() => []),
  enrichAssetsWithStatusFromLoaded: vi.fn(async (assets: unknown[]) => assets),
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { POST } from "@/app/api/assets/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

function assetCreateResult(row: unknown) {
  return row as Awaited<ReturnType<typeof db.asset.create>>;
}

function post(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/assets", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(staffUser);
  vi.mocked(db.asset.create).mockResolvedValue(assetCreateResult({
    id: "cmasset000000000000000001",
    assetTag: "SMOKE-1",
    name: "Smoke Test Asset",
    type: "equipment",
    brand: "Smoke",
    model: "Verifier",
    qrCodeValue: "SMOKE-1",
    locationId: "cmlocation000000000000001",
    categoryId: "cmcategory000000000000001",
    departmentId: "54a4abe3-2500-4a28-8970-86f671cfffd3",
    location: { id: "cmlocation000000000000001", name: "Camp Randall" },
    category: { id: "cmcategory000000000000001", name: "Accessories" },
  }));
  vi.mocked(createAuditEntry).mockResolvedValue(undefined);
});

describe("POST /api/assets", () => {
  it("accepts existing UUID department IDs when creating an asset", async () => {
    const res = await POST(
      post({
        assetTag: "SMOKE-1",
        name: "Smoke Test Asset",
        type: "equipment",
        brand: "Smoke",
        model: "Verifier",
        qrCodeValue: "SMOKE-1",
        locationId: "cmlocation000000000000001",
        categoryId: "cmcategory000000000000001",
        departmentId: "54a4abe3-2500-4a28-8970-86f671cfffd3",
        availableForReservation: true,
        availableForCheckout: true,
        availableForCustody: true,
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(201);
    expect(db.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          departmentId: "54a4abe3-2500-4a28-8970-86f671cfffd3",
        }),
      }),
    );
    expect(createAuditEntry).toHaveBeenCalledOnce();
  });
});
