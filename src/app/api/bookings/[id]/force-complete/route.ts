import { BookingKind } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { forceCompleteCheckout, getBookingDetail } from "@/lib/services/bookings";
import { getAllowedBookingActions, requireBookingAction } from "@/lib/services/booking-rules";

const forceCompleteSchema = z.object({
  reason: z.string().trim().min(10, "Reason must be at least 10 characters").max(1000),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = forceCompleteSchema.parse(await req.json());

  await requireBookingAction(id, user, "force-complete", BookingKind.CHECKOUT);
  await forceCompleteCheckout({ bookingId: id, actorUserId: user.id, reason: body.reason });

  const refreshed = await getBookingDetail(id);
  const allowedActions = getAllowedBookingActions(user, refreshed);
  return ok({ data: { ...refreshed, allowedActions } });
});
