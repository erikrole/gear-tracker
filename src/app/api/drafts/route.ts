import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { z } from "zod";
import { optionalSportCodeSchema } from "@/lib/validation";

const saveDraftSchema = z.object({
  id: z.string().cuid().optional(),
  kind: z.enum(["CHECKOUT", "RESERVATION"]),
  title: z.string().max(200).default(""),
  requesterUserId: z.string().cuid().optional(),
  locationId: z.string().cuid().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  eventId: z.string().cuid().nullable().optional(),
  eventIds: z.array(z.string().cuid()).max(3).optional(),
  sportCode: optionalSportCodeSchema,
  notes: z.string().max(10000).optional(),
  serializedAssetIds: z.array(z.string().cuid()).default([]),
  bulkItems: z
    .array(z.object({ bulkSkuId: z.string().cuid(), quantity: z.number().int().positive() }))
    .default([]),
});

function dedupeIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function draftExpiryCutoff(now = new Date()) {
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

async function resolveDraftEventLinks(tx: Prisma.TransactionClient, body: z.infer<typeof saveDraftSchema>) {
  if (body.eventId && body.eventIds && body.eventIds.length > 0) {
    throw new HttpError(400, "Provide either eventId or eventIds, not both");
  }

  const requestedEventIds = body.eventIds && body.eventIds.length > 0
    ? dedupeIds(body.eventIds)
    : body.eventId ? [body.eventId] : [];

  if (requestedEventIds.length === 0) {
    return { primaryEventId: null, sortedEventIds: [] as string[] };
  }

  const events = await tx.calendarEvent.findMany({
    where: { id: { in: requestedEventIds } },
    select: { id: true, startsAt: true },
  });

  if (events.length !== requestedEventIds.length) {
    throw new HttpError(400, "One or more eventIds do not exist");
  }

  const sortedEventIds = events
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((event) => event.id);

  return { primaryEventId: sortedEventIds[0] ?? null, sortedEventIds };
}

/** GET /api/drafts — list current user's drafts */
export const GET = withAuth(async (_req, { user }) => {
  await db.booking.deleteMany({
    where: { status: "DRAFT", createdBy: user.id, updatedAt: { lt: draftExpiryCutoff() } },
  });

  const drafts = await db.booking.findMany({
    where: { status: "DRAFT", createdBy: user.id, updatedAt: { gte: draftExpiryCutoff() } },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      location: { select: { id: true, name: true } },
      _count: { select: { serializedItems: true, bulkItems: true } },
    },
  });

  return ok({
    data: drafts.map((d) => ({
      id: d.id,
      kind: d.kind,
      title: d.title,
      locationName: d.location?.name ?? null,
      startsAt: d.startsAt.toISOString(),
      endsAt: d.endsAt.toISOString(),
      itemCount: d._count.serializedItems + d._count.bulkItems,
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
});

/** POST /api/drafts — create or update a draft booking */
export const POST = withAuth(async (req, { user }) => {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  const body = saveDraftSchema.parse(rawBody);

  // Default dates: now + 4 hours if not provided
  const now = new Date();
  const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const startsAt = body.startsAt ? new Date(body.startsAt) : now;
  const endsAt = body.endsAt ? new Date(body.endsAt) : fourHoursLater;

  const bookingData = {
    kind: body.kind as "CHECKOUT" | "RESERVATION",
    title: body.title || "Untitled draft",
    status: "DRAFT" as const,
    requesterUserId: body.requesterUserId ?? user.id,
    locationId: body.locationId ?? (await defaultLocationId()),
    startsAt,
    endsAt,
    createdBy: user.id,
    sportCode: body.sportCode ?? null,
    notes: body.notes ?? null,
  };

  let draftId: string;

  if (body.id) {
    // Update existing draft — verify ownership and DRAFT status
    const existing = await db.booking.findFirst({
      where: { id: body.id, status: "DRAFT", createdBy: user.id },
    });
    if (!existing) {
      throw new HttpError(404, "Draft not found");
    }

    await db.$transaction(async (tx) => {
      const { primaryEventId, sortedEventIds } = await resolveDraftEventLinks(tx, body);
      await tx.booking.update({ where: { id: body.id! }, data: { ...bookingData, eventId: primaryEventId } });
      // Replace items and event links
      await tx.bookingSerializedItem.deleteMany({ where: { bookingId: body.id! } });
      await tx.bookingBulkItem.deleteMany({ where: { bookingId: body.id! } });
      await tx.bookingEvent.deleteMany({ where: { bookingId: body.id! } });
      if (body.serializedAssetIds.length > 0) {
        await tx.bookingSerializedItem.createMany({
          data: body.serializedAssetIds.map((assetId) => ({
            bookingId: body.id!,
            assetId,
            allocationStatus: "draft",
          })),
        });
      }
      if (body.bulkItems.length > 0) {
        await tx.bookingBulkItem.createMany({
          data: body.bulkItems.map((bi) => ({
            bookingId: body.id!,
            bulkSkuId: bi.bulkSkuId,
            plannedQuantity: bi.quantity,
          })),
        });
      }
      if (sortedEventIds.length > 0) {
        await tx.bookingEvent.createMany({
          data: sortedEventIds.map((eventId, ordinal) => ({
            bookingId: body.id!,
            eventId,
            ordinal,
          })),
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    draftId = body.id;
  } else {
    // Create new draft
    const draft = await db.$transaction(async (tx) => {
      const { primaryEventId, sortedEventIds } = await resolveDraftEventLinks(tx, body);
      const booking = await tx.booking.create({ data: { ...bookingData, eventId: primaryEventId } });
      if (body.serializedAssetIds.length > 0) {
        await tx.bookingSerializedItem.createMany({
          data: body.serializedAssetIds.map((assetId) => ({
            bookingId: booking.id,
            assetId,
            allocationStatus: "draft",
          })),
        });
      }
      if (body.bulkItems.length > 0) {
        await tx.bookingBulkItem.createMany({
          data: body.bulkItems.map((bi) => ({
            bookingId: booking.id,
            bulkSkuId: bi.bulkSkuId,
            plannedQuantity: bi.quantity,
          })),
        });
      }
      if (sortedEventIds.length > 0) {
        await tx.bookingEvent.createMany({
          data: sortedEventIds.map((eventId, ordinal) => ({
            bookingId: booking.id,
            eventId,
            ordinal,
          })),
        });
      }
      return booking;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    draftId = draft.id;
  }

  return ok({ data: { id: draftId } }, body.id ? 200 : 201);
});

/** Get first location as fallback when none specified */
async function defaultLocationId(): Promise<string> {
  const loc = await db.location.findFirst({ select: { id: true } });
  if (!loc) throw new HttpError(500, "No locations configured. Please add a location in Settings.");
  return loc.id;
}
