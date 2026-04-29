import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";
import { checkoutCompleteBody } from "@/lib/schemas/kiosk";
import { nextBookingRef } from "@/lib/services/booking-ref";

/**
 * Complete a kiosk checkout: create booking + allocations in one step.
 * This is the scan-first flow: items were validated during scanning,
 * now we create the booking and allocations atomically.
 */
export const POST = withKiosk(async (req, { kiosk }) => {
  const body = checkoutCompleteBody.parse(await req.json());
  const actorId = body.actorId;
  const locationId = body.locationId || kiosk.locationId;
  const assetIds = body.items;

  // Verify user exists and is active
  const user = await db.user.findFirst({
    where: { id: actorId, active: true },
    select: { id: true, name: true, role: true },
  });
  if (!user) throw new HttpError(404, "User not found");

  const now = new Date();
  const endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default: due in 24h

  try {
    const { booking, refNumber } = await db.$transaction(
      async (tx) => {
        // Generate ref-number inside the transaction so the advisory lock
        // (held by `nextBookingRef`) serializes concurrent kiosk completions.
        const refNumber = await nextBookingRef(tx, "CO");

        // Create the booking
        const b = await tx.booking.create({
          data: {
            kind: "CHECKOUT",
            status: "OPEN",
            title: `Kiosk Checkout — ${user.name}`,
            requesterUserId: actorId,
            createdBy: actorId,
            locationId,
            startsAt: now,
            endsAt,
            refNumber,
            notes: `Created via kiosk at ${kiosk.locationName}`,
          },
        });

        // Create serialized items + allocations
        const ids = assetIds.map((a) => a.assetId);

        await tx.bookingSerializedItem.createMany({
          data: ids.map((assetId) => ({
            bookingId: b.id,
            assetId,
            allocationStatus: "active",
          })),
        });

        await tx.assetAllocation.createMany({
          data: ids.map((assetId) => ({
            assetId,
            bookingId: b.id,
            startsAt: now,
            endsAt,
            active: true,
            kind: "CHECKOUT" as const,
          })),
        });

        return { booking: b, refNumber };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    await createAuditEntry({
      actorId,
      actorRole: user.role,
      entityType: "booking",
      entityId: booking.id,
      action: "kiosk_checkout",
      after: {
        refNumber,
        itemCount: assetIds.length,
        source: "KIOSK",
        kioskDeviceId: kiosk.kioskId,
        locationName: kiosk.locationName,
      },
    });

    return ok({
      bookingId: booking.id,
      refNumber,
      itemCount: assetIds.length,
      endsAt,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[] | string | undefined) ?? "";
      const targetStr = Array.isArray(target) ? target.join(",") : String(target);
      // Booking.refNumber collision → race with another concurrent kiosk; retryable.
      if (targetStr.includes("ref_number") || targetStr.includes("refNumber")) {
        throw new HttpError(
          409,
          "Could not allocate a checkout reference — please retry",
        );
      }
      // BookingSerializedItem(bookingId, assetId) → item-level conflict.
      throw new HttpError(409, "One or more items are no longer available");
    }
    throw error;
  }
});
