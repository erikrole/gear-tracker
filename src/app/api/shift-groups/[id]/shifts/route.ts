import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { z } from "zod";
import { ShiftArea, ShiftWorkerType } from "@prisma/client";

const addShiftSchema = z.object({
  area: z.nativeEnum(ShiftArea),
  workerType: z.nativeEnum(ShiftWorkerType).default("ST"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "create");
  const { id } = params;

  const body = addShiftSchema.parse(await req.json());

  const result = await db.$transaction(async (tx) => {
    const group = await tx.shiftGroup.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!group) throw new HttpError(404, "Shift group not found");

    const startsAt = body.startsAt ? new Date(body.startsAt) : group.event.startsAt;
    const endsAt = body.endsAt ? new Date(body.endsAt) : group.event.endsAt;

    const shift = await tx.shift.create({
      data: {
        shiftGroupId: id,
        area: body.area,
        workerType: body.workerType,
        startsAt,
        endsAt,
        notes: body.notes,
      },
    });

    // Mark as manually edited so auto-generation doesn't overwrite
    await tx.shiftGroup.update({
      where: { id },
      data: { manuallyEdited: true },
    });

    return shift;
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "shift",
    entityId: result.id,
    action: "shift_added",
    after: { area: result.area, workerType: result.workerType, shiftGroupId: id },
  });

  return ok({ data: result }, 201);
});
