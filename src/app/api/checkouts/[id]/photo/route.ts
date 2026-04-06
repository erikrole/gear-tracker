import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { HttpError, ok } from "@/lib/http";
import { validateImage, uploadBookingPhoto } from "@/lib/blob";
import { db } from "@/lib/db";
import { ScanPhase } from "@prisma/client";

/**
 * POST /api/checkouts/:id/photo?phase=CHECKOUT|CHECKIN
 * Upload a condition photo for a booking checkout or checkin.
 */
export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const url = new URL(req.url);
  const phaseParam = url.searchParams.get("phase");

  if (phaseParam !== "CHECKOUT" && phaseParam !== "CHECKIN") {
    throw new HttpError(400, "Query param 'phase' must be CHECKOUT or CHECKIN");
  }
  const phase: ScanPhase = phaseParam as ScanPhase;

  // Verify booking exists, is OPEN checkout, and user has checkin permission
  const booking = await db.booking.findUnique({
    where: { id },
    select: { id: true, status: true, kind: true, requesterUserId: true },
  });
  if (!booking) throw new HttpError(404, "Booking not found");
  if (booking.kind !== "CHECKOUT") {
    throw new HttpError(400, "Photos are only supported for checkouts");
  }
  if (booking.status !== "OPEN") {
    throw new HttpError(400, "Booking must be in OPEN status to upload photos");
  }
  // Students can only upload photos for their own checkouts
  if (user.role === "STUDENT" && booking.requesterUserId !== user.id) {
    throw new HttpError(403, "You can only upload photos for your own checkouts");
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new HttpError(400, "Expected multipart file field named 'file'");
  }

  const validationError = validateImage(file);
  if (validationError) {
    throw new HttpError(400, validationError);
  }

  // Upload to Vercel Blob
  const imageUrl = await uploadBookingPhoto(file, id, phase);

  // Create BookingPhoto record
  const photo = await db.bookingPhoto.create({
    data: {
      bookingId: id,
      phase,
      imageUrl,
      actorId: user.id,
    },
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "booking",
    entityId: id,
    action: "booking_photo_uploaded",
    after: { phase, imageUrl, photoId: photo.id },
  });

  return ok({ photoId: photo.id, imageUrl });
});
