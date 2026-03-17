import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { cancelBooking } from "@/lib/services/bookings";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  await requireBookingAction(id, user, "cancel");

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
