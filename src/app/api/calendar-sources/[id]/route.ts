import { Prisma } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";

const patchSourceSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  enabled: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "No fields to update" });

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "calendar_source", "edit");
  await enforceRateLimit(`calendar-sources:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const { id } = params;

  const source = await db.calendarSource.findUnique({ where: { id } });
  if (!source) throw new HttpError(404, "Source not found");

  const body = patchSourceSchema.parse(await req.json());
  const updated = await db.calendarSource.update({
    where: { id },
    data: body,
    include: { _count: { select: { events: true } } },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "calendar_source",
    entityId: id,
    action: "updated",
    before: { name: source.name, url: source.url, enabled: source.enabled },
    after: body,
  });

  return ok({ data: updated });
});

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "calendar_source", "delete");
  await enforceRateLimit(`calendar-sources:write:${user.id}`, SETTINGS_MUTATION_LIMIT);
  const { id } = params;

  const source = await db.calendarSource.findUnique({ where: { id } });
  if (!source) throw new HttpError(404, "Source not found");

  await db.$transaction(async (tx) => {
    // Nullify eventId on any bookings linked to this source's events
    // so the cascade delete of events doesn't violate FK constraints
    await tx.booking.updateMany({
      where: { event: { sourceId: id } },
      data: { eventId: null },
    });

    // Cascade deletes associated CalendarEvent rows (schema onDelete: Cascade)
    await tx.calendarSource.delete({ where: { id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "calendar_source",
    entityId: id,
    action: "delete",
    before: { name: source.name },
  });

  return ok({ deleted: true });
});
