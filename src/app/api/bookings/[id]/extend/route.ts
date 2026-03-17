import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { extendBooking } from "@/lib/services/bookings";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { extendBookingSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = extendBookingSchema.parse(await req.json());

  await requireBookingAction(id, user, "extend");

  const updated = await extendBooking(id, user.id, new Date(body.endsAt));
  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "extend",
    after: { endsAt: body.endsAt },
  });
  return ok({ data: updated });
});
