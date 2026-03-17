import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { checkAvailability } from "@/lib/services/availability";
import { parseDateRange } from "@/lib/time";
import { availabilitySchema } from "@/lib/validation";

export const POST = withAuth(async (req) => {
  const body = availabilitySchema.parse(await req.json());
  const { start, end } = parseDateRange(body.startsAt, body.endsAt);

  const result = await checkAvailability(db, {
    locationId: body.locationId,
    startsAt: start,
    endsAt: end,
    serializedAssetIds: body.serializedAssetIds,
    bulkItems: body.bulkItems,
    excludeBookingId: body.excludeBookingId
  });

  return ok(result);
});
