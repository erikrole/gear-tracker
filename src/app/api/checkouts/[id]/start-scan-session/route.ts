import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { startScanSession } from "@/lib/services/scans";
import { startScanSessionSchema } from "@/lib/validation";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "checkout", "scan");
  const { id } = params;

  // Students can only start scan sessions on their own checkouts
  if (user.role === "STUDENT") {
    const booking = await db.booking.findUnique({
      where: { id },
      select: { requesterUserId: true, createdBy: true },
    });
    if (!booking || (booking.requesterUserId !== user.id && booking.createdBy !== user.id)) {
      throw new HttpError(403, "You can only scan items on your own checkouts");
    }
  }

  const body = startScanSessionSchema.parse(await req.json());

  const session = await startScanSession({
    bookingId: id,
    actorUserId: user.id,
    phase: body.phase
  });

  return ok({ data: session });
});
