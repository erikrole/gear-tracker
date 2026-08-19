import { Role } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { canReadUserProfile } from "@/lib/user-visibility";
import { requireCollaboratorCapability } from "@/lib/collaborator-access";
import { normalizeSportCode } from "@/lib/sports";
import { HttpError, ok, parsePagination } from "@/lib/http";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import {
  getScoreboardForUser,
  getScoreboardScope,
  type ScoreboardResult,
} from "@/lib/services/scoreboard";

const scoreboardQuerySchema = z.object({
  season: z.string().trim().max(20).optional(),
  sportCode: z.string().trim().max(20).optional(),
  result: z.enum(["WIN", "LOSS"]).optional(),
});

export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
  requireRole(user.role, [Role.ADMIN, Role.STAFF, Role.STUDENT, Role.COLLABORATOR]);

  const target = await db.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true, hiddenFromRoster: true },
  });
  if (!target || !canReadUserProfile(user, target)) {
    throw new HttpError(404, "User not found");
  }

  if (user.role === Role.COLLABORATOR && user.id !== params.id) {
    requireCollaboratorCapability(user, "PEOPLE_DIRECTORY_VIEW");
    throw new HttpError(403, "Forbidden");
  }
  if (target.role === Role.COLLABORATOR && user.id !== params.id && user.role !== Role.ADMIN) {
    throw new HttpError(403, "Forbidden");
  }
  if (user.role === Role.STUDENT && user.id !== params.id && target.role !== Role.COLLABORATOR) {
    throw new HttpError(403, "Forbidden");
  }

  const url = new URL(req.url);
  const query = scoreboardQuerySchema.parse({
    season: url.searchParams.get("season") ?? undefined,
    sportCode: url.searchParams.get("sportCode") ?? undefined,
    result: url.searchParams.get("result") ?? undefined,
  });
  if (!getScoreboardScope(query.season)) {
    throw new HttpError(400, "Unsupported scoreboard season");
  }

  const { limit, offset } = parsePagination(url.searchParams);
  const scoreboard = await getScoreboardForUser(
    params.id,
    {
      sportCode: query.sportCode ? normalizeSportCode(query.sportCode) : undefined,
      result: query.result as ScoreboardResult | undefined,
    },
    { limit, offset },
  );

  return ok({ data: scoreboard });
});
