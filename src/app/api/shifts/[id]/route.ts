export const runtime = "edge";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateShiftSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift", "edit");
    const { id } = await ctx.params;

    const body = updateShiftSchema.parse(await req.json());
    const existing = await db.shift.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Shift not found");

    const data: Record<string, unknown> = {};
    if (body.startsAt) data.startsAt = new Date(body.startsAt);
    if (body.endsAt) data.endsAt = new Date(body.endsAt);
    if (body.notes !== undefined) data.notes = body.notes;

    const updated = await db.shift.update({ where: { id }, data });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift",
      entityId: id,
      action: "shift_updated",
      before: { startsAt: existing.startsAt, endsAt: existing.endsAt },
      after: { startsAt: updated.startsAt, endsAt: updated.endsAt },
    });

    return ok({ data: updated });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift", "delete");
    const { id } = await ctx.params;

    const existing = await db.shift.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Shift not found");

    await db.shift.delete({ where: { id } });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift",
      entityId: id,
      action: "shift_deleted",
      before: { area: existing.area, workerType: existing.workerType },
    });

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
