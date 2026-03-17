import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createShiftSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "shift", "create");

  const body = createShiftSchema.parse(await req.json());

  const group = await db.shiftGroup.findUnique({ where: { id: body.shiftGroupId } });
  if (!group) throw new HttpError(404, "Shift group not found");

  const shift = await db.shift.create({
    data: {
      shiftGroupId: body.shiftGroupId,
      area: body.area,
      workerType: body.workerType,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      notes: body.notes,
    },
  });

  // Mark group as manually edited
  await db.shiftGroup.update({
    where: { id: body.shiftGroupId },
    data: { manuallyEdited: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift",
    entityId: shift.id,
    action: "shift_created",
    after: { area: body.area, workerType: body.workerType },
  });

  return ok({ data: shift }, 201);
});
