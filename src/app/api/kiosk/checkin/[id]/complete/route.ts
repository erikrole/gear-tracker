import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";

/**
 * Complete a kiosk check-in (return).
 * If all items are returned, marks the booking as COMPLETED.
 */
export const POST = withKiosk<{ id: string }>(async (req, { kiosk, params }) => {
  const body = await req.json();
  const actorId = body.actorId as string;

  if (!actorId) throw new HttpError(400, "actorId required");

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      kind: true,
      refNumber: true,
      serializedItems: {
        select: { allocationStatus: true },
      },
    },
  });

  if (!booking || booking.kind !== "CHECKOUT" || booking.status !== "OPEN") {
    throw new HttpError(404, "Active checkout not found");
  }

  const totalItems = booking.serializedItems.length;
  const returnedItems = booking.serializedItems.filter(
    (i) => i.allocationStatus === "returned"
  ).length;

  // If all items returned, complete the booking
  if (returnedItems >= totalItems) {
    await db.booking.update({
      where: { id: params.id },
      data: { status: "COMPLETED" },
    });
  }

  const user = await db.user.findUnique({
    where: { id: actorId },
    select: { role: true },
  });

  await createAuditEntry({
    actorId,
    actorRole: user?.role ?? "STUDENT",
    entityType: "booking",
    entityId: booking.id,
    action: "kiosk_checkin",
    after: {
      refNumber: booking.refNumber,
      returnedItems,
      totalItems,
      completed: returnedItems >= totalItems,
      source: "KIOSK",
      kioskDeviceId: kiosk.kioskId,
    },
  });

  return ok({
    returnedItems,
    totalItems,
    completed: returnedItems >= totalItems,
  });
});
