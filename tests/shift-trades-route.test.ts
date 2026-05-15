import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  withAuth:
    (handler: (req: Request, ctx: { user: { id: string; role: string } }) => Promise<Response>) =>
    (req: Request) =>
      handler(req, { user: { id: "staff-1", role: "STAFF" } }),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/services/shift-trades", () => ({
  listTrades: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  postTrade: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEntry: vi.fn(),
}));

import { listTrades } from "@/lib/services/shift-trades";
import { GET } from "@/app/api/shift-trades/route";

const mockListTrades = vi.mocked(listTrades);

function request(query = "") {
  return new Request(`https://app.example.com/api/shift-trades${query}`);
}

describe("shift trades route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTrades.mockResolvedValue({ data: [], total: 0 });
  });

  it("passes validated status and area filters to the service", async () => {
    const res = await GET(request("?status=CLAIMED&area=VIDEO&limit=150&offset=20"), {
      params: Promise.resolve({}),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: [], total: 0 });
    expect(mockListTrades).toHaveBeenCalledWith({
      status: "CLAIMED",
      area: "VIDEO",
      limit: 100,
      offset: 20,
    });
  });

  it("rejects invalid status filters before querying", async () => {
    await expect(
      GET(request("?status=APPROVED"), { params: Promise.resolve({}) }),
    ).rejects.toMatchObject({ status: 400 });

    expect(mockListTrades).not.toHaveBeenCalled();
  });

  it("rejects invalid area filters before querying", async () => {
    await expect(
      GET(request("?area=FIELD"), { params: Promise.resolve({}) }),
    ).rejects.toMatchObject({ status: 400 });

    expect(mockListTrades).not.toHaveBeenCalled();
  });
});
