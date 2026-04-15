import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  // requireBookingAction checks: staff+ role, OPEN status, CHECKOUT kind
  const booking = await requireBookingAction(params.id, user, "nudge");

  const isOverdue = booking.endsAt < new Date();
  if (!isOverdue) {
    throw new HttpError(400, "Booking is not overdue");
  }

  // Create in-app notification for the requester
  const hours = Math.round((Date.now() - booking.endsAt.getTime()) / 3_600_000);
  const [, requester] = await Promise.all([
    db.notification.create({
      data: {
        userId: booking.requesterUserId,
        type: "overdue_nudge",
        title: "Overdue gear reminder",
        body: `"${booking.title}" is ${hours}h overdue. Please return the gear.`,
        payload: { bookingId: booking.id },
        dedupeKey: `nudge-${booking.id}-${new Date().toISOString().slice(0, 13)}`,
      },
    }),
    db.user.findUnique({ where: { id: booking.requesterUserId }, select: { name: true } }),
  ]);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: booking.id,
    action: "overdue_nudge_sent",
    after: { requester: requester?.name ?? booking.requesterUserId, overdueHours: hours },
  });

  return ok({ success: true });
});
