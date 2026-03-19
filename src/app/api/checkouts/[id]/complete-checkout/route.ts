import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { completeCheckoutScan } from "@/lib/services/scans";
import { createAuditEntry } from "@/lib/audit";
import { evaluateBadges } from "@/lib/services/badges";
import { db } from "@/lib/db";

export const POST = withAuth<{ id: string }>(async (_req, { user, params }) => {
  requirePermission(user.role, "checkout", "complete");
  const { id } = params;
  const result = await completeCheckoutScan(id, user.id, user.role);

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "complete_checkout",
  });

  // Badge evaluation: checkout scan completed (Speed Scan, Early Bird, etc.)
  const booking = await db.booking.findUnique({
    where: { id },
    select: { requesterUserId: true },
  });
  if (booking) {
    evaluateBadges(booking.requesterUserId, "checkout_scan_completed", { bookingId: id }).catch(
      (err) => console.error("Badge evaluation error:", err)
    );
  }

  return ok(result);
});
