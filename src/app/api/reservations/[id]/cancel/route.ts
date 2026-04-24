import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { cancelReservation } from "@/lib/services/bookings";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";
import { ok } from "@/lib/http";
import { createReservationLifecycleNotification } from "@/lib/services/notifications";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  await requireBookingAction(id, user, "cancel", BookingKind.RESERVATION);

  const booking = await db.booking.findUniqueOrThrow({
    where: { id },
    select: { requesterUserId: true, title: true },
  });

  const result = await cancelReservation(id, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "cancel",
  });

  void createReservationLifecycleNotification({
    bookingId: id,
    bookingTitle: booking.title ?? id,
    requesterUserId: booking.requesterUserId,
    actorUserId: user.id,
    event: "cancelled",
  });

  return ok(result);
});
