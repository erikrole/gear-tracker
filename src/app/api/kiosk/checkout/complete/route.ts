import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";

/**
 * Complete a kiosk checkout: create booking + allocations in one step.
 * This is the scan-first flow: items were validated during scanning,
 * now we create the booking and allocations atomically.
 */
export const POST = withKiosk(async (req, { kiosk }) => {
  const body = await req.json();
  const actorId = body.actorId as string;
  const locationId = (body.locationId as string) || kiosk.locationId;
  const assetIds = body.items as Array<{ assetId: string }>;

  if (!actorId) throw new HttpError(400, "actorId required");
  if (!assetIds?.length) throw new HttpError(400, "At least one item required");

  // Verify user exists
  const user = await db.user.findUnique({
    where: { id: actorId },
    select: { id: true, name: true, role: true },
  });
  if (!user) throw new HttpError(404, "User not found");

  const now = new Date();
  const endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default: due in 24h

  // Generate ref number
  const lastBooking = await db.booking.findFirst({
    where: { refNumber: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { refNumber: true },
  });
  const lastSeq = lastBooking?.refNumber
    ? parseInt(lastBooking.refNumber.replace(/^(CO|RV)-/, ""), 10)
    : 0;
  const refNumber = `CO-${String(lastSeq + 1).padStart(4, "0")}`;

  try {
    const booking = await db.$transaction(
      async (tx) => {
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

        return b;
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
      throw new HttpError(409, "One or more items are no longer available");
    }
    throw error;
  }
});
