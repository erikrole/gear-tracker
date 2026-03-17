import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateShiftSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "edit");
  const { id } = params;

  const body = updateShiftSchema.parse(await req.json());
  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Shift not found");

  const data: Record<string, unknown> = {};
  if (body.startsAt) data.startsAt = new Date(body.startsAt);
  if (body.endsAt) data.endsAt = new Date(body.endsAt);
  if (body.notes !== undefined) data.notes = body.notes;

  const updated = await db.shift.update({ where: { id }, data });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift",
    entityId: id,
    action: "shift_updated",
    before: { startsAt: existing.startsAt, endsAt: existing.endsAt },
    after: { startsAt: updated.startsAt, endsAt: updated.endsAt },
  });

  return ok({ data: updated });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "shift", "delete");
  const { id } = params;

  const existing = await db.shift.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Shift not found");

  await db.shift.delete({ where: { id } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift",
    entityId: id,
    action: "shift_deleted",
    before: { area: existing.area, workerType: existing.workerType },
  });

  return ok({ success: true });
});
