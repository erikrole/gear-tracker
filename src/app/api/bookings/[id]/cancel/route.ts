import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { cancelBooking } from "@/lib/services/bookings";
import { requireCheckoutAction, requireReservationAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  const booking = await db.booking.findUnique({ where: { id } });
  if (booking?.kind === "CHECKOUT") {
    await requireCheckoutAction(id, user, "cancel");
  } else if (booking?.kind === "RESERVATION") {
    await requireReservationAction(id, user, "cancel");
  }

  const result = await cancelBooking(id, user.id);
  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "cancel",
  });
  return ok(result);
});
