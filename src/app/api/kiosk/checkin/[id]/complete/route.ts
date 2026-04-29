import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";
import { createAuditEntry } from "@/lib/audit";
import { kioskCompleteCheckin } from "@/lib/services/bookings-checkin";
import { checkinCompleteBody } from "@/lib/schemas/kiosk";

/**
 * Complete a kiosk check-in (return).
 *
 * Delegates to `kioskCompleteCheckin` (SERIALIZABLE wrapper, bulk-aware
 * `maybeAutoComplete`, scan-session close, lost-unit handling). The route
 * keeps the kiosk audit shape (`action: "kiosk_checkin"`, `source: "KIOSK"`,
 * `kioskDeviceId`, before/after counts) unchanged for the iOS client.
 */
export const POST = withKiosk<{ id: string }>(async (req, { kiosk, params }) => {
  const { actorId } = checkinCompleteBody.parse(await req.json());

  const user = await db.user.findFirst({
    where: { id: actorId, active: true },
    select: { id: true, role: true },
  });
  if (!user) throw new HttpError(404, "User not found");

  const result = await kioskCompleteCheckin({
    bookingId: params.id,
    actorUserId: actorId,
  });

  await createAuditEntry({
    actorId,
    actorRole: user.role,
    entityType: "booking",
    entityId: params.id,
    action: "kiosk_checkin",
    before: {
      returnedItems: result.returnedItems,
      totalItems: result.totalItems,
    },
    after: {
      refNumber: result.refNumber,
      returnedItems: result.returnedItems,
      totalItems: result.totalItems,
      completed: result.completed,
      source: "KIOSK",
      kioskDeviceId: kiosk.kioskId,
    },
  });

  return ok({
    returnedItems: result.returnedItems,
    totalItems: result.totalItems,
    completed: result.completed,
  });
});
