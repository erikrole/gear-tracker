import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { assertCallTimePair, assertDateOrder, parseOptionalDate } from "@/lib/api-dates";
import { z } from "zod";
import { Prisma, ShiftArea, ShiftWorkerType } from "@prisma/client";

const addShiftSchema = z.object({
  area: z.nativeEnum(ShiftArea),
  workerType: z.nativeEnum(ShiftWorkerType).default("ST"),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  callStartsAt: z.string().optional().nullable(),
  callEndsAt: z.string().optional().nullable(),
  notes: z.string().max(5000).optional(),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "shift", "create");
  const { id } = params;

  const body = addShiftSchema.parse(await req.json());
  const overrideStartsAt = parseOptionalDate(body.startsAt, "startsAt");
  const overrideEndsAt = parseOptionalDate(body.endsAt, "endsAt");
  const callStartsAt = parseOptionalDate(body.callStartsAt ?? undefined, "callStartsAt");
  const callEndsAt = parseOptionalDate(body.callEndsAt ?? undefined, "callEndsAt");
  if ((body.callStartsAt !== undefined) !== (body.callEndsAt !== undefined)) {
    throw new HttpError(400, "callStartsAt and callEndsAt must both be provided or both omitted");
  }
  assertCallTimePair(callStartsAt, callEndsAt);
  assertDateOrder(overrideStartsAt, overrideEndsAt, "endsAt must be after startsAt", { allowEqual: false });
  assertDateOrder(callStartsAt, callEndsAt, "callEndsAt must be after callStartsAt", { allowEqual: false });

  const result = await db.$transaction(async (tx) => {
    const group = await tx.shiftGroup.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!group) throw new HttpError(404, "Shift group not found");

    const startsAt = overrideStartsAt ?? group.event.startsAt;
    const endsAt = overrideEndsAt ?? group.event.endsAt;
    assertDateOrder(startsAt, endsAt, "endsAt must be after startsAt", { allowEqual: false });

    const shift = await tx.shift.create({
      data: {
        shiftGroupId: id,
        area: body.area,
        workerType: body.workerType,
        startsAt,
        endsAt,
        callStartsAt,
        callEndsAt,
        notes: body.notes,
      },
    });

    // Mark as manually edited so auto-generation doesn't overwrite
    await tx.shiftGroup.update({
      where: { id },
      data: { manuallyEdited: true },
    });

    return shift;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

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
