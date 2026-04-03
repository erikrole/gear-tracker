import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { BookingKind, ScanPhase, CheckinReportType } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";
import { createAuditEntry } from "@/lib/audit";
import { checkinReportSchema } from "@/lib/validation";
import { notifyItemReport } from "@/lib/services/notifications";

/**
 * POST /api/checkouts/[id]/checkin-report
 *
 * Report a serialized item as damaged or lost during check-in scanning.
 * - DAMAGED: item must have been scanned first
 * - LOST: item does not need to be scanned (counts as "accounted for")
 */
export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;

  const booking = await requireBookingAction(id, user, "checkin", BookingKind.CHECKOUT);

  const body = await req.json();
  const parsed = checkinReportSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { assetId, type, description } = parsed.data;

  // Verify the asset belongs to this booking
  const bookingItem = await db.bookingSerializedItem.findUnique({
    where: { bookingId_assetId: { bookingId: id, assetId } },
    include: { asset: { select: { assetTag: true, brand: true, model: true } } },
  });

  if (!bookingItem) {
    throw new HttpError(404, "Item not found in this checkout");
  }

  // For DAMAGED reports, verify the item has been scanned
  if (type === "DAMAGED") {
    const scanEvent = await db.scanEvent.findFirst({
      where: {
        bookingId: id,
        assetId,
        phase: ScanPhase.CHECKIN,
        success: true,
      },
    });

    if (!scanEvent) {
      throw new HttpError(400, "Item must be scanned before reporting damage");
    }
  }

  // Upsert the report (unique on bookingId + assetId)
  const report = await db.checkinItemReport.upsert({
    where: { bookingId_assetId: { bookingId: id, assetId } },
    create: {
      bookingId: id,
      assetId,
      type: type as CheckinReportType,
      description,
      reportedById: user.id,
    },
    update: {
      type: type as CheckinReportType,
      description,
      reportedById: user.id,
    },
  });

  // Notify supervisors (fire-and-forget to avoid blocking the response)
  const itemDesc = `${bookingItem.asset.brand} ${bookingItem.asset.model}`;
  notifyItemReport({
    bookingId: id,
    bookingTitle: booking.title,
    assetId,
    assetTag: bookingItem.asset.assetTag,
    itemDescription: itemDesc,
    reportType: type as "DAMAGED" | "LOST",
    damageDescription: description,
    reporterName: user.name,
  }).catch((err) => {
    console.error("[REPORT] Failed to send supervisor notifications:", err);
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: `checkin_report_${type.toLowerCase()}`,
    after: { assetId, assetTag: bookingItem.asset.assetTag, description },
  });

  return ok({
    id: report.id,
    type: report.type,
    description: report.description,
  });
});
