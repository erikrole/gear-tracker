import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { updateReservation } from "@/lib/services/bookings";
import { BookingKind } from "@prisma/client";
import { getAllowedBookingActions, requireBookingAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";
import { updateReservationSchema } from "@/lib/validation";

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  const reservation = await db.booking.findUnique({
    where: { id },
    include: {
      location: { select: { id: true, name: true } },
      requester: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } },
      serializedItems: {
        select: {
          id: true, assetId: true, allocationStatus: true,
          asset: { select: { id: true, assetTag: true, brand: true, model: true, serialNumber: true } },
        },
      },
      bulkItems: {
        select: {
          id: true, plannedQuantity: true, checkedOutQuantity: true, checkedInQuantity: true,
          bulkSku: { select: { id: true, name: true, unit: true } },
        },
      },
    }
  });

  if (!reservation || reservation.kind !== "RESERVATION") {
    throw new HttpError(404, "Reservation not found");
  }

  const allowedActions = getAllowedBookingActions(user, reservation);

  return ok({ data: { ...reservation, allowedActions } });
});

export const PATCH = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;

  await requireBookingAction(id, user, "edit", BookingKind.RESERVATION);

  const body = updateReservationSchema.parse(await req.json());

  const reservation = await updateReservation(id, user.id, {
    title: body.title,
    requesterUserId: body.requesterUserId,
    locationId: body.locationId,
    startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
    endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
    serializedAssetIds: body.serializedAssetIds,
    bulkItems: body.bulkItems,
    notes: body.notes,
    status: body.status
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "edit",
    after: body,
  });

  return ok({ data: reservation });
});
