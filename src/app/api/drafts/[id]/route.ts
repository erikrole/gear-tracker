import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";

/** GET /api/drafts/[id] — load a single draft for resume */
export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  const draft = await db.booking.findFirst({
    where: { id, status: "DRAFT", createdBy: user.id },
    include: {
      location: { select: { id: true, name: true } },
      serializedItems: {
        select: {
          assetId: true,
          asset: { select: { id: true, assetTag: true, brand: true, model: true, type: true } },
        },
      },
      bulkItems: {
        select: {
          bulkSkuId: true,
          plannedQuantity: true,
          bulkSku: { select: { id: true, name: true, unit: true } },
        },
      },
      event: {
        select: {
          id: true,
          summary: true,
          startsAt: true,
          endsAt: true,
          sportCode: true,
          isHome: true,
          opponent: true,
          rawLocationText: true,
          location: { select: { id: true, name: true } },
        },
      },
      events: {
        orderBy: { ordinal: "asc" },
        include: {
          event: {
            select: {
              id: true,
              summary: true,
              startsAt: true,
              endsAt: true,
              sportCode: true,
              isHome: true,
              opponent: true,
              rawLocationText: true,
              location: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!draft) {
    throw new HttpError(404, "Draft not found");
  }

  const linkedEvents = draft.events.length > 0
    ? draft.events.map((link) => link.event)
    : draft.event ? [draft.event] : [];

  return ok({
    data: {
      id: draft.id,
      kind: draft.kind,
      title: draft.title,
      requesterUserId: draft.requesterUserId,
      locationId: draft.locationId,
      locationName: draft.location?.name ?? null,
      startsAt: draft.startsAt.toISOString(),
      endsAt: draft.endsAt.toISOString(),
      eventId: draft.eventId,
      events: linkedEvents.map((event) => ({
        ...event,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
      })),
      sportCode: draft.sportCode,
      notes: draft.notes ?? "",
      serializedAssetIds: draft.serializedItems.map((si) => si.assetId),
      bulkItems: draft.bulkItems.map((bi) => ({
        bulkSkuId: bi.bulkSkuId,
        quantity: bi.plannedQuantity,
      })),
      updatedAt: draft.updatedAt.toISOString(),
    },
  });
});

/** DELETE /api/drafts/[id] — discard a draft */
export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  const draft = await db.booking.findFirst({
    where: { id, status: "DRAFT", createdBy: user.id },
  });

  if (!draft) {
    throw new HttpError(404, "Draft not found");
  }

  // Cascade deletes BookingSerializedItem + BookingBulkItem automatically
  await db.booking.delete({ where: { id } });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "draft_discarded",
    before: { title: draft.title, kind: draft.kind },
  });

  return ok({ success: true });
});
