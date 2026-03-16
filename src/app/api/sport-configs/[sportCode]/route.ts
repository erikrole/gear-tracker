import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateSportConfigSchema } from "@/lib/validation";
import { getSportConfig, upsertSportConfig, toggleSportConfig } from "@/lib/services/sport-configs";
import { createAuditEntry } from "@/lib/audit";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ sportCode: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "sport_config", "view");
    const { sportCode } = await ctx.params;
    const config = await getSportConfig(sportCode);
    if (!config) throw new HttpError(404, "Sport config not found");
    return ok({ data: config });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ sportCode: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "sport_config", "manage");
    const { sportCode } = await ctx.params;

    const body = updateSportConfigSchema.parse(await req.json());
    const existing = await getSportConfig(sportCode);
    if (!existing) throw new HttpError(404, "Sport config not found");

    let config;
    if (body.shiftConfigs) {
      config = await upsertSportConfig(sportCode, body.active ?? existing.active, body.shiftConfigs);
    } else if (body.active !== undefined) {
      config = await toggleSportConfig(sportCode, body.active);
    } else {
      config = existing;
    }

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "sport_config",
      entityId: existing.id,
      action: "sport_config_updated",
      before: { active: existing.active },
      after: { active: config!.active, ...body },
    });

    return ok({ data: config });
  } catch (error) {
    return fail(error);
  }
}
