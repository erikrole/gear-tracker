import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { extendBooking, getBookingDetail } from "@/lib/services/bookings";
import { requireBookingAction, getAllowedBookingActions } from "@/lib/services/booking-rules";
import { extendBookingSchema } from "@/lib/validation";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = extendBookingSchema.parse(await req.json());

  await requireBookingAction(id, user, "extend");

  // Service creates audit entry with proper before/after snapshots
  await extendBooking(id, user.id, new Date(body.endsAt));

  // Re-fetch enriched detail so UI has full state (auditLogs, allowedActions, etc.)
  const refreshed = await getBookingDetail(id);
  const allowedActions = getAllowedBookingActions(user, refreshed);
  return ok({ data: { ...refreshed, allowedActions } });
});
