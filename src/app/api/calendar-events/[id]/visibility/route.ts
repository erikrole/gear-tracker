import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    throw new HttpError(403, "Only staff and admins can hide events");
  }

  const { id } = params;
  const body = await req.json();
  const isHidden = body.isHidden === true;

  const existing = await db.calendarEvent.findUnique({
    where: { id },
    select: { id: true, summary: true, isHidden: true },
  });
  if (!existing) throw new HttpError(404, "Event not found");

  const event = await db.calendarEvent.update({
    where: { id },
    data: { isHidden },
    select: { id: true, isHidden: true, summary: true },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "calendar_event",
    entityId: id,
    action: "calendar_event_visibility_updated",
    before: { isHidden: existing.isHidden, summary: existing.summary },
    after: { isHidden: event.isHidden, summary: event.summary },
  });

  return ok({ data: event });
});
