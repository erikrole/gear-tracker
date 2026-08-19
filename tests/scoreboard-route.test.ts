import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: { id: "viewer-1", role: "ADMIN" },
  target: { id: "target-1", role: "STUDENT", hiddenFromRoster: false },
  findUnique: vi.fn(),
  canReadUserProfile: vi.fn(),
  requireCollaboratorCapability: vi.fn(),
  requireRole: vi.fn(),
  normalizeSportCode: vi.fn(),
  parsePagination: vi.fn(),
  getScoreboardScope: vi.fn(),
  getScoreboardForUser: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  withAuth: (handler: (req: Request, ctx: { user: typeof mocks.currentUser; params: { id: string } }) => Promise<Response>) =>
    async (req: Request, context: { params: Promise<{ id: string }> }) => {
      try {
        return await handler(req, { user: mocks.currentUser, params: await context.params });
      } catch (error) {
        const status = (error as { status?: number }).status ?? 500;
        const message = error instanceof Error ? error.message : "Internal server error";
        return new Response(JSON.stringify({ error: message }), { status });
      }
    },
}));

vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/user-visibility", () => ({ canReadUserProfile: mocks.canReadUserProfile }));
vi.mock("@/lib/collaborator-access", () => ({ requireCollaboratorCapability: mocks.requireCollaboratorCapability }));
vi.mock("@/lib/rbac", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/sports", () => ({ normalizeSportCode: mocks.normalizeSportCode }));
vi.mock("@/lib/http", () => ({
  HttpError: class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  ok: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
  parsePagination: mocks.parsePagination,
}));
vi.mock("@/lib/services/scoreboard", () => ({
  getScoreboardScope: mocks.getScoreboardScope,
  getScoreboardForUser: mocks.getScoreboardForUser,
}));

import { GET } from "@/app/api/users/[id]/scoreboard/route";

const run = GET as unknown as (
  req: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.id = "viewer-1";
  mocks.currentUser.role = "ADMIN";
  mocks.target.role = "STUDENT";
  mocks.target.hiddenFromRoster = false;
  mocks.findUnique.mockResolvedValue(mocks.target);
  mocks.canReadUserProfile.mockReturnValue(true);
  mocks.normalizeSportCode.mockImplementation((value: string) => `normalized-${value}`);
  mocks.parsePagination.mockReturnValue({ limit: 25, offset: 4 });
  mocks.getScoreboardScope.mockReturnValue({ key: "2026-27" });
  mocks.getScoreboardForUser.mockResolvedValue({ summary: { wins: 1, losses: 0 } });
});

function request(query = "") {
  return new Request(`https://app.example.com/api/users/target-1/scoreboard${query}`);
}

const context = { params: Promise.resolve({ id: "target-1" }) };

describe("GET /api/users/[id]/scoreboard", () => {
  it("applies the season, filters, and bounded pagination to the read service", async () => {
    const response = await run(
      request("?season=2026-27&sportCode=SB&result=WIN&limit=25&offset=4"),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.requireRole).toHaveBeenCalledWith("ADMIN", ["ADMIN", "STAFF", "STUDENT", "COLLABORATOR"]);
    expect(mocks.getScoreboardForUser).toHaveBeenCalledWith(
      "target-1",
      { sportCode: "normalized-SB", result: "WIN" },
      { limit: 25, offset: 4 },
    );
    await expect(response.json()).resolves.toEqual({ data: { summary: { wins: 1, losses: 0 } } });
  });

  it("keeps the unsupported-season and collaborator privacy gates server-side", async () => {
    mocks.getScoreboardScope.mockReturnValueOnce(null);
    const badSeason = await run(request("?season=2099-00"), context);

    expect(badSeason.status).toBe(400);
    expect(mocks.getScoreboardForUser).not.toHaveBeenCalled();

    mocks.currentUser.role = "COLLABORATOR";
    const collaboratorResponse = await run(request(), context);

    expect(collaboratorResponse.status).toBe(403);
    expect(mocks.requireCollaboratorCapability).toHaveBeenCalledWith(mocks.currentUser, "PEOPLE_DIRECTORY_VIEW");
    expect(mocks.getScoreboardForUser).not.toHaveBeenCalled();
  });
});
