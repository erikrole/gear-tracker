export const runtime = "edge";

import { requireAuth } from "@/lib/auth";
import { ok, fail } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { upsertSportConfigSchema } from "@/lib/validation";
import { getAllSportConfigs, upsertSportConfig } from "@/lib/services/sport-configs";
import { createAuditEntry } from "@/lib/audit";

export async function GET() {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "sport_config", "view");
    const configs = await getAllSportConfigs();
    return ok({ data: configs });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "sport_config", "manage");

    const body = upsertSportConfigSchema.parse(await req.json());
    const config = await upsertSportConfig(
      body.sportCode,
      body.active ?? true,
      body.shiftConfigs ?? []
    );

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "sport_config",
      entityId: config!.id,
      action: "sport_config_upserted",
      after: { sportCode: body.sportCode, active: body.active, shiftConfigs: body.shiftConfigs },
    });

    return ok({ data: config }, 201);
  } catch (error) {
    return fail(error);
  }
}
