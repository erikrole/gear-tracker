import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { upsertSportConfigSchema } from "@/lib/validation";
import { getAllSportConfigs, upsertSportConfig } from "@/lib/services/sport-configs";
import { createAuditEntry } from "@/lib/audit";

export const GET = withAuth(async (_req, { user }) => {
  requirePermission(user.role, "sport_config", "view");
  const configs = await getAllSportConfigs();
  return ok({ data: configs });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "sport_config", "manage");

  const body = upsertSportConfigSchema.parse(await req.json());
  const config = await upsertSportConfig(
    body.sportCode,
    body.active ?? true,
    body.shiftConfigs ?? []
  );

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "sport_config",
    entityId: config!.id,
    action: "sport_config_upserted",
    after: { sportCode: body.sportCode, active: body.active, shiftConfigs: body.shiftConfigs },
  });

  return ok({ data: config }, 201);
});
