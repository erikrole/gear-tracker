import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { cancelReservation } from "@/lib/services/bookings";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { ok } from "@/lib/http";
import { createReservationLifecycleNotification } from "@/lib/services/notifications";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  await requireBookingAction(id, user, "cancel", BookingKind.RESERVATION);

  const booking = await db.booking.findUniqueOrThrow({
    where: { id },
    select: { requesterUserId: true, title: true },
  });

  // cancelReservation writes the canonical `cancelled` audit entry inside
  // its SERIALIZABLE transaction — no second audit write here.
  const result = await cancelReservation(id, user.id);

  void createReservationLifecycleNotification({
    bookingId: id,
    bookingTitle: booking.title ?? id,
    requesterUserId: booking.requesterUserId,
    actorUserId: user.id,
    event: "cancelled",
  });

  return ok(result);
});
