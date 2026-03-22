import { ScanType } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { recordScan } from "@/lib/services/scans";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { scanSchema } from "@/lib/validation";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = scanSchema.parse(await req.json());

  if (body.phase !== "CHECKIN") {
    throw new HttpError(400, "phase must be CHECKIN");
  }

  await requireBookingAction(id, user, "checkin", BookingKind.CHECKOUT);

  const result = await recordScan({
    bookingId: id,
    actorUserId: user.id,
    phase: "CHECKIN",
    scanType: body.scanType as ScanType,
    scanValue: body.scanValue,
    quantity: body.quantity,
    unitNumbers: body.unitNumbers,
    deviceContext: body.deviceContext
  });

  return ok({ data: result });
});
