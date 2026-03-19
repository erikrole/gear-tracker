import { withAuth } from "@/lib/api";
import { completeCheckinScan } from "@/lib/services/scans";
import { ok } from "@/lib/http";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";
import { evaluateBadges, handleOnTimeReturn, handleOverdueReturn } from "@/lib/services/badges";
import { db } from "@/lib/db";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const { id } = params;

  await requireBookingAction(id, user, "checkin", BookingKind.CHECKOUT);

  const result = await completeCheckinScan(id, user.id, user.role);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "complete_checkin",
  });

  // Badge evaluation: track return streak + evaluate booking-completed badges
  const booking = await db.booking.findUnique({
    where: { id },
    select: { requesterUserId: true, endsAt: true, updatedAt: true },
  });
  if (booking) {
    const isOnTime = booking.updatedAt <= booking.endsAt;
    if (isOnTime) {
      await handleOnTimeReturn(booking.requesterUserId);
    } else {
      await handleOverdueReturn(booking.requesterUserId);
    }
    evaluateBadges(booking.requesterUserId, "booking_completed", { bookingId: id }).catch(
      (err) => console.error("Badge evaluation error:", err)
    );
    evaluateBadges(booking.requesterUserId, "checkin_scan_completed", { bookingId: id }).catch(
      (err) => console.error("Badge evaluation error:", err)
    );
  }

  return ok(result);
});
