import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntryTx } from "@/lib/audit";
import { z } from "zod";

const visibilitySchema = z.object({
  isHidden: z.boolean(),
}).strict();

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    throw new HttpError(403, "Only staff and admins can hide events");
  }

  const { id } = params;
  const rawBody = await req.json().catch(() => {
    throw new HttpError(400, "Invalid JSON body");
  });
  const body = visibilitySchema.parse(rawBody);

  const event = await db.$transaction(async (tx) => {
    const existing = await tx.calendarEvent.findUnique({
      where: { id },
      select: { id: true, summary: true, isHidden: true },
    });
    if (!existing) throw new HttpError(404, "Event not found");

    const updated = await tx.calendarEvent.update({
      where: { id },
      data: { isHidden: body.isHidden },
      select: { id: true, isHidden: true, summary: true },
    });

    await createAuditEntryTx(tx, {
      actorId: user.id,
      actorRole: user.role,
      entityType: "calendar_event",
      entityId: id,
      action: "calendar_event_visibility_updated",
      before: { isHidden: existing.isHidden, summary: existing.summary },
      after: { isHidden: updated.isHidden, summary: updated.summary },
    });

    return updated;
  });

  return ok({ data: event });
});
