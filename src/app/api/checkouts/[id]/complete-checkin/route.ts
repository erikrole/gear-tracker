import { withAuth } from "@/lib/api";
import { completeCheckinScan } from "@/lib/services/scans";
import { ok } from "@/lib/http";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";

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

  return ok(result);
});
