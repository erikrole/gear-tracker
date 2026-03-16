import { requireAuth } from "@/lib/auth";
import { ok, fail, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { regenerateShiftsForEvent } from "@/lib/services/shift-generation";
import { createAuditEntry } from "@/lib/audit";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift", "create");
    const { id } = await ctx.params;

    const group = await db.shiftGroup.findUnique({
      where: { id },
      select: { eventId: true },
    });
    if (!group) throw new HttpError(404, "Shift group not found");

    const result = await regenerateShiftsForEvent(group.eventId);

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_group",
      entityId: id,
      action: "shift_group_regenerated",
      after: { added: result.added },
    });

    return ok({ data: result });
  } catch (error) {
    return fail(error);
  }
}
