import { ScanType } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { recordScan } from "@/lib/services/scans";
import { scanSchema } from "@/lib/validation";
import { handleSuccessfulScan, handleFailedScan } from "@/lib/services/badges";

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

  try {
    const result = await recordScan({
      bookingId: id,
      actorUserId: user.id,
      phase: body.phase,
      scanType: body.scanType as ScanType,
      scanValue: body.scanValue,
      quantity: body.quantity,
      unitNumbers: body.unitNumbers,
      deviceContext: body.deviceContext,
      idempotencyKey: body.idempotencyKey
    });

    // Track scan accuracy for Perfectionist badge streak
    handleSuccessfulScan(user.id).catch(() => {});

    return ok({ data: result });
  } catch (error) {
    // Track failed scans for streak resets (only for scan-related errors)
    if (error instanceof HttpError && error.status === 400) {
      handleFailedScan(user.id).catch(() => {});
    }
    throw error;
  }
});
