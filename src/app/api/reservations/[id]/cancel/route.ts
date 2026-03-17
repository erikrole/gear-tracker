import { withAuth } from "@/lib/api";
import { cancelReservation } from "@/lib/services/bookings";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";
import { ok } from "@/lib/http";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  await requireBookingAction(id, user, "cancel", BookingKind.RESERVATION);

  const result = await cancelReservation(id, user.id);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "cancel",
  });

  return ok(result);
});
