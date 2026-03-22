import { ScanType } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { recordScan } from "@/lib/services/scans";
import { scanSchema } from "@/lib/validation";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "checkout", "scan");
  const { id } = params;

  // Students can only scan on their own checkouts
  if (user.role === "STUDENT") {
    const booking = await db.booking.findUnique({
      where: { id },
      select: { requesterUserId: true, createdBy: true },
    });
    if (!booking || (booking.requesterUserId !== user.id && booking.createdBy !== user.id)) {
      throw new HttpError(403, "You can only scan items on your own checkouts");
    }
  }

  const body = scanSchema.parse(await req.json());

  const result = await recordScan({
    bookingId: id,
    actorUserId: user.id,
    phase: body.phase,
    scanType: body.scanType as ScanType,
    scanValue: body.scanValue,
    quantity: body.quantity,
    unitNumbers: body.unitNumbers,
    deviceContext: body.deviceContext
  });

  return ok({ data: result });
});
