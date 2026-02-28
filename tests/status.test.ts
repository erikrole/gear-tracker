import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing the status service
vi.mock("@/lib/db", () => ({
  db: {
    asset: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    assetAllocation: {
      findMany: vi.fn()
    }
  }
}));

import { db } from "@/lib/db";
import {
  deriveAssetStatuses,
  deriveAssetStatus,
  enrichAssetsWithStatus,
  countAssetsByEffectiveStatus
} from "@/lib/services/status";

const mockDb = db as unknown as {
  asset: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  assetAllocation: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deriveAssetStatuses", () => {
  it("returns empty map for empty input", async () => {
    const result = await deriveAssetStatuses([]);
    expect(result.size).toBe(0);
  });

  it("returns MAINTENANCE for assets with MAINTENANCE status", async () => {
    mockDb.asset.findMany.mockResolvedValue([
      { id: "a1", status: "MAINTENANCE" }
    ]);

    const result = await deriveAssetStatuses(["a1"]);
    expect(result.get("a1")).toBe("MAINTENANCE");
    // Should NOT query allocations for terminal statuses
    expect(mockDb.assetAllocation.findMany).not.toHaveBeenCalled();
  });

  it("returns RETIRED for assets with RETIRED status", async () => {
    mockDb.asset.findMany.mockResolvedValue([
      { id: "a1", status: "RETIRED" }
    ]);

    const result = await deriveAssetStatuses(["a1"]);
    expect(result.get("a1")).toBe("RETIRED");
    expect(mockDb.assetAllocation.findMany).not.toHaveBeenCalled();
  });

  it("returns CHECKED_OUT when asset has active checkout allocation", async () => {
    mockDb.asset.findMany.mockResolvedValue([
      { id: "a1", status: "AVAILABLE" }
    ]);
    mockDb.assetAllocation.findMany.mockResolvedValue([
      {
        assetId: "a1",
        startsAt: new Date("2026-02-01"),
        endsAt: new Date("2026-03-01"),
        booking: { kind: "CHECKOUT", status: "OPEN" }
      }
    ]);

    const result = await deriveAssetStatuses(["a1"]);
    expect(result.get("a1")).toBe("CHECKED_OUT");
  });

  it("returns RESERVED when asset has active reservation overlapping now", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 3600_000);
    const future = new Date(now.getTime() + 3600_000);

    mockDb.asset.findMany.mockResolvedValue([
      { id: "a1", status: "AVAILABLE" }
    ]);
    mockDb.assetAllocation.findMany.mockResolvedValue([
      {
        assetId: "a1",
        startsAt: past,
        endsAt: future,
        booking: { kind: "RESERVATION", status: "BOOKED" }
      }
    ]);

    const result = await deriveAssetStatuses(["a1"]);
    expect(result.get("a1")).toBe("RESERVED");
  });

  it("returns AVAILABLE when asset has reservation in the future (not overlapping now)", async () => {
    const future1 = new Date(Date.now() + 86400_000);
    const future2 = new Date(Date.now() + 172800_000);

    mockDb.asset.findMany.mockResolvedValue([
      { id: "a1", status: "AVAILABLE" }
    ]);
    mockDb.assetAllocation.findMany.mockResolvedValue([
      {
        assetId: "a1",
        startsAt: future1,
        endsAt: future2,
        booking: { kind: "RESERVATION", status: "BOOKED" }
      }
    ]);

    const result = await deriveAssetStatuses(["a1"]);
    expect(result.get("a1")).toBe("AVAILABLE");
  });

  it("returns AVAILABLE when no active allocations exist", async () => {
    mockDb.asset.findMany.mockResolvedValue([
      { id: "a1", status: "AVAILABLE" }
    ]);
    mockDb.assetAllocation.findMany.mockResolvedValue([]);

    const result = await deriveAssetStatuses(["a1"]);
    expect(result.get("a1")).toBe("AVAILABLE");
  });

  it("CHECKED_OUT takes priority over RESERVED", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 3600_000);
    const future = new Date(now.getTime() + 3600_000);

    mockDb.asset.findMany.mockResolvedValue([
      { id: "a1", status: "AVAILABLE" }
    ]);
    mockDb.assetAllocation.findMany.mockResolvedValue([
      {
        assetId: "a1",
        startsAt: past,
        endsAt: future,
        booking: { kind: "RESERVATION", status: "BOOKED" }
      },
      {
        assetId: "a1",
        startsAt: past,
        endsAt: future,
        booking: { kind: "CHECKOUT", status: "OPEN" }
      }
    ]);

    const result = await deriveAssetStatuses(["a1"]);
    expect(result.get("a1")).toBe("CHECKED_OUT");
  });

  it("handles mixed statuses across multiple assets", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 3600_000);
    const future = new Date(now.getTime() + 3600_000);

    mockDb.asset.findMany.mockResolvedValue([
      { id: "a1", status: "AVAILABLE" },
      { id: "a2", status: "MAINTENANCE" },
      { id: "a3", status: "AVAILABLE" },
      { id: "a4", status: "RETIRED" }
    ]);
    mockDb.assetAllocation.findMany.mockResolvedValue([
      {
        assetId: "a1",
        startsAt: past,
        endsAt: future,
        booking: { kind: "CHECKOUT", status: "OPEN" }
      }
    ]);

    const result = await deriveAssetStatuses(["a1", "a2", "a3", "a4"]);
    expect(result.get("a1")).toBe("CHECKED_OUT");
    expect(result.get("a2")).toBe("MAINTENANCE");
    expect(result.get("a3")).toBe("AVAILABLE");
    expect(result.get("a4")).toBe("RETIRED");
  });
});

describe("deriveAssetStatus", () => {
  it("returns status for a single asset", async () => {
    mockDb.asset.findMany.mockResolvedValue([
      { id: "a1", status: "MAINTENANCE" }
    ]);

    const result = await deriveAssetStatus("a1");
    expect(result).toBe("MAINTENANCE");
  });

  it("returns AVAILABLE for unknown asset id", async () => {
    mockDb.asset.findMany.mockResolvedValue([]);

    const result = await deriveAssetStatus("nonexistent");
    expect(result).toBe("AVAILABLE");
  });
});

describe("enrichAssetsWithStatus", () => {
  it("adds computedStatus to each asset", async () => {
    const assets = [
      { id: "a1", status: "AVAILABLE" as const, assetTag: "TAG-1" },
      { id: "a2", status: "MAINTENANCE" as const, assetTag: "TAG-2" }
    ];

    mockDb.asset.findMany.mockResolvedValue([
      { id: "a1", status: "AVAILABLE" },
      { id: "a2", status: "MAINTENANCE" }
    ]);
    mockDb.assetAllocation.findMany.mockResolvedValue([]);

    const result = await enrichAssetsWithStatus(assets);
    expect(result).toHaveLength(2);
    expect(result[0].computedStatus).toBe("AVAILABLE");
    expect(result[0].assetTag).toBe("TAG-1");
    expect(result[1].computedStatus).toBe("MAINTENANCE");
  });

  it("returns empty array for empty input", async () => {
    const result = await enrichAssetsWithStatus([]);
    expect(result).toEqual([]);
  });
});

describe("countAssetsByEffectiveStatus", () => {
  it("counts all status categories correctly", async () => {
    mockDb.asset.count
      .mockResolvedValueOnce(2)  // maintenance
      .mockResolvedValueOnce(1); // retired
    mockDb.asset.findMany.mockResolvedValueOnce([
      { id: "a1" },
      { id: "a2" },
      { id: "a3" }
    ]);

    // deriveAssetStatuses calls for the AVAILABLE assets
    mockDb.asset.findMany.mockResolvedValueOnce([
      { id: "a1", status: "AVAILABLE" },
      { id: "a2", status: "AVAILABLE" },
      { id: "a3", status: "AVAILABLE" }
    ]);
    mockDb.assetAllocation.findMany.mockResolvedValue([
      {
        assetId: "a1",
        startsAt: new Date("2026-01-01"),
        endsAt: new Date("2026-12-31"),
        booking: { kind: "CHECKOUT", status: "OPEN" }
      }
    ]);

    const result = await countAssetsByEffectiveStatus();
    expect(result.MAINTENANCE).toBe(2);
    expect(result.RETIRED).toBe(1);
    expect(result.CHECKED_OUT).toBe(1);
    expect(result.AVAILABLE).toBe(2);
  });

  it("handles zero available assets", async () => {
    mockDb.asset.count
      .mockResolvedValueOnce(5)  // maintenance
      .mockResolvedValueOnce(3); // retired
    mockDb.asset.findMany.mockResolvedValueOnce([]); // no AVAILABLE assets

    const result = await countAssetsByEffectiveStatus();
    expect(result.AVAILABLE).toBe(0);
    expect(result.CHECKED_OUT).toBe(0);
    expect(result.RESERVED).toBe(0);
    expect(result.MAINTENANCE).toBe(5);
    expect(result.RETIRED).toBe(3);
  });
});
