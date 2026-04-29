import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";

/**
 * Confirm kiosk pickup: transition PENDING_PICKUP → OPEN.
 * Called after student scans their items at the kiosk.
 */
export const POST = withKiosk<{ id: string }>(async (req, { kiosk, params }) => {
  const body = await req.json();
  const actorId = body.actorId as string;

  if (!actorId) throw new HttpError(400, "actorId required");

  const user = await db.user.findUnique({
    where: { id: actorId },
    select: { id: true, name: true, role: true },
  });
  if (!user) throw new HttpError(404, "User not found");

  const booking = await db.booking.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, kind: true, title: true, _count: { select: { serializedItems: true } } },
  });

  if (!booking || booking.kind !== "CHECKOUT") {
    throw new HttpError(404, "Checkout not found");
  }

  if (booking.status !== "PENDING_PICKUP") {
    throw new HttpError(409, `Cannot confirm pickup — booking is in ${booking.status} state`);
  }

  await db.booking.update({
    where: { id: params.id },
    data: { status: "OPEN" },
  });

  await createAuditEntry({
    actorId,
    actorRole: user.role,
    entityType: "booking",
    entityId: params.id,
    action: "kiosk_pickup",
    after: {
      status: "OPEN",
      source: "KIOSK",
      kioskDeviceId: kiosk.kioskId,
      locationName: kiosk.locationName,
    },
  });

  return ok({ success: true, bookingId: params.id });
});
