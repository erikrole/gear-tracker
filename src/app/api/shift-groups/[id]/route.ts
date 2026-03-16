export const runtime = "edge";

import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ok, fail, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateShiftGroupSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift", "view");
    const { id } = await ctx.params;

    const group = await db.shiftGroup.findUnique({
      where: { id },
      include: {
        event: true,
        shifts: {
          include: {
            assignments: {
              include: {
                user: { select: { id: true, name: true, email: true, role: true, primaryArea: true } },
                assigner: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: [{ area: "asc" }, { workerType: "asc" }],
        },
      },
    });

    if (!group) throw new HttpError(404, "Shift group not found");
    return ok({ data: group });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "shift", "edit");
    const { id } = await ctx.params;

    const body = updateShiftGroupSchema.parse(await req.json());
    const existing = await db.shiftGroup.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Shift group not found");

    const data: Record<string, unknown> = {};
    if (body.isPremier !== undefined) data.isPremier = body.isPremier;
    if (body.notes !== undefined) data.notes = body.notes;
    data.manuallyEdited = true;

    const updated = await db.shiftGroup.update({
      where: { id },
      data,
      include: { event: true, shifts: true },
    });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "shift_group",
      entityId: id,
      action: "shift_group_updated",
      before: { isPremier: existing.isPremier, notes: existing.notes },
      after: { isPremier: updated.isPremier, notes: updated.notes },
    });

    return ok({ data: updated });
  } catch (error) {
    return fail(error);
  }
}
