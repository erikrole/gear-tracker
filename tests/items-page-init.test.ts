import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  withAuth:
    (handler: (req: Request, ctx: { user: { role: string } }) => Promise<Response>) =>
    (req: Request) => handler(req, { user: { role: "STAFF" } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    location: { findMany: vi.fn() },
    department: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    asset: { groupBy: vi.fn() },
    kit: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { GET } from "@/app/api/items-page-init/route";

const mockDb = db as unknown as {
  location: { findMany: ReturnType<typeof vi.fn> };
  department: { findMany: ReturnType<typeof vi.fn> };
  category: { findMany: ReturnType<typeof vi.fn> };
  asset: { groupBy: ReturnType<typeof vi.fn> };
  kit: { findMany: ReturnType<typeof vi.fn> };
};

describe("items page init route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockDb.location.findMany.mockResolvedValue([{ id: "loc-1", name: "Kohl Center" }]);
    mockDb.department.findMany.mockResolvedValue([{ id: "dept-1", name: "Video" }]);
    mockDb.category.findMany.mockResolvedValue([{ id: "cat-1", name: "Cameras", parentId: null }]);
    mockDb.asset.groupBy.mockResolvedValue([{ brand: "Sony" }]);
    mockDb.kit.findMany.mockResolvedValue([{ id: "kit-1", name: "Basketball" }]);
  });

  it("returns role and every reference group in the documented envelope", async () => {
    const response = await GET(new Request("https://app.example.com/api/items-page-init"), { params: Promise.resolve({}) });

    expect(await response.json()).toEqual({
      data: {
        user: { role: "STAFF" },
        locations: [{ id: "loc-1", name: "Kohl Center" }],
        departments: [{ id: "dept-1", name: "Video" }],
        categories: [{ id: "cat-1", name: "Cameras", parentId: null }],
        brands: ["Sony"],
        kits: [{ id: "kit-1", name: "Basketball" }],
      },
      partialFailures: [],
    });
  });

  it("keeps healthy groups and names a failed reference query", async () => {
    mockDb.category.findMany.mockRejectedValue(new Error("category database unavailable"));

    const response = await GET(new Request("https://app.example.com/api/items-page-init"), { params: Promise.resolve({}) });
    const body = await response.json();

    expect(body.data.locations).toEqual([{ id: "loc-1", name: "Kohl Center" }]);
    expect(body.data.categories).toEqual([]);
    expect(body.partialFailures).toEqual(["categories"]);
  });
});
