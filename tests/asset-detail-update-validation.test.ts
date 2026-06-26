import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    asset: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

vi.mock("@/lib/services/status", () => ({
  deriveAssetStatus: vi.fn(),
}));

vi.mock("@/lib/firmware-watch-targets", () => ({
  canonicalFirmwareIdentity: vi.fn(() => null),
}));

import { requireAuth } from "@/lib/auth";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { PATCH } from "@/app/api/assets/[id]/route";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: Role.STAFF,
  avatarUrl: null,
};

function patch(body: Record<string, unknown>) {
  return new Request("https://app.example.com/api/assets/asset-1", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      host: "app.example.com",
      origin: "https://app.example.com",
    },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/assets/[id] validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(createAuditEntry).mockResolvedValue(undefined);
    vi.mocked(db.asset.findUnique).mockResolvedValue({
      id: "asset-1",
      assetTag: "FX3 1",
      name: "Sony FX3",
      type: "equipment",
      brand: "Sony",
      model: "FX3",
      status: "AVAILABLE",
      departmentId: null,
    } as Awaited<ReturnType<typeof db.asset.findUnique>>);
    vi.mocked(db.asset.update).mockResolvedValue({
      id: "asset-1",
      assetTag: "FX3 1",
      name: "Sony FX3",
      type: "equipment",
      brand: "Sony",
      model: "FX3",
      status: "AVAILABLE",
      departmentId: "54a4abe3-2500-4a28-8970-86f671cfffd3",
      location: { id: "loc-1", name: "Camp Randall" },
      category: { id: "cat-1", name: "Camera Bodies" },
      department: { id: "54a4abe3-2500-4a28-8970-86f671cfffd3", name: "Video" },
    } as unknown as Awaited<ReturnType<typeof db.asset.update>>);
  });

  it("accepts UUID department IDs from the item detail form", async () => {
    const departmentId = "54a4abe3-2500-4a28-8970-86f671cfffd3";

    const res = await PATCH(
      patch({ departmentId }),
      { params: Promise.resolve({ id: "asset-1" }) },
    );

    expect(res.status).toBe(200);
    expect(db.asset.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "asset-1" },
      data: { departmentId },
    }));
    expect(createAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "asset",
      entityId: "asset-1",
      action: "updated",
      before: expect.objectContaining({ departmentId: null }),
      after: expect.objectContaining({ departmentId }),
    }));
  });
});
