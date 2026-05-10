import { z } from "zod";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { badgesEnabled } from "@/lib/badges";
import { awardBadgeManually } from "@/lib/badges/queries";
import { HttpError, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

const manualAwardSchema = z.object({
  userId: z.string().cuid(),
  definitionId: z.string().cuid(),
  note: z.string().trim().max(500).optional(),
});

export const POST = withAuth(async (req, { user }) => {
  requireRole(user.role, ["ADMIN"]);
  if (!badgesEnabled()) {
    throw new HttpError(409, "Badges are disabled");
  }

  const body = manualAwardSchema.parse(await req.json());
  const award = await awardBadgeManually({
    userId: body.userId,
    definitionId: body.definitionId,
    awardedById: user.id,
    note: body.note,
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "badge_award",
    entityId: award.id,
    action: "badge_awarded_manually",
    after: {
      userId: body.userId,
      definitionId: body.definitionId,
      badgeKey: award.definition.key,
      note: body.note ?? null,
    },
  });

  return ok({
    data: {
      id: award.id,
      userId: award.userId,
      definitionId: award.definitionId,
      awardedAt: award.awardedAt.toISOString(),
      source: award.source,
      note: award.note,
      definition: award.definition,
    },
  }, 201);
});
