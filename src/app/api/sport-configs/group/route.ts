import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateSportConfigGroupSchema } from "@/lib/validation";
import { upsertSportConfigsForGroup } from "@/lib/services/sport-configs";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

/**
 * POST /api/sport-configs/group
 * Apply the same patch atomically to many sport codes (used by grouped sports
 * like Cross Country [MXC, WXC]). Either all codes update or none do.
 */
export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "sport_config", "manage");
  await enforceRateLimit(`sport-configs:write:${user.id}`, SETTINGS_MUTATION_LIMIT);

  const body = updateSportConfigGroupSchema.parse(await req.json());

  const updated = await upsertSportConfigsForGroup(body.codes, {
    active: body.active,
    shiftConfigs: body.shiftConfigs,
    shiftStartOffset: body.shiftStartOffset,
    shiftEndOffset: body.shiftEndOffset,
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "sport_config",
    entityId: body.codes.join(","),
    action: "sport_config_group_updated",
    after: body,
  });

  return ok({ data: updated });
});
