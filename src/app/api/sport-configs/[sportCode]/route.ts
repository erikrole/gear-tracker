import { withAuth } from "@/lib/api";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateSportConfigSchema } from "@/lib/validation";
import { getSportConfig, upsertSportConfig, toggleSportConfig } from "@/lib/services/sport-configs";
import { createAuditEntry } from "@/lib/audit";

export const GET = withAuth<{ sportCode: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "sport_config", "view");
  const { sportCode } = params;
  const config = await getSportConfig(sportCode);
  if (!config) throw new HttpError(404, "Sport config not found");
  return ok({ data: config });
});

export const PATCH = withAuth<{ sportCode: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "sport_config", "manage");
  const { sportCode } = params;

  const body = updateSportConfigSchema.parse(await req.json());
  const existing = await getSportConfig(sportCode);
  if (!existing) throw new HttpError(404, "Sport config not found");

  let config;
  const hasCallTimeChange = body.callTimeBefore !== undefined || body.callTimeAfter !== undefined;
  if (body.shiftConfigs || hasCallTimeChange) {
    config = await upsertSportConfig(
      sportCode,
      body.active ?? existing.active,
      body.shiftConfigs ?? existing.shiftConfigs.map((sc) => ({ area: sc.area, homeCount: sc.homeCount, awayCount: sc.awayCount })),
      body.callTimeBefore,
      body.callTimeAfter,
    );
  } else if (body.active !== undefined) {
    config = await toggleSportConfig(sportCode, body.active);
  } else {
    config = existing;
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "sport_config",
    entityId: existing.id,
    action: "sport_config_updated",
    before: { active: existing.active },
    after: { active: config!.active, ...body },
  });

  return ok({ data: config });
});
