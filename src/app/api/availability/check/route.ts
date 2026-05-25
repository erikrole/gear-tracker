import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { checkAvailability, getBulkAvailability } from "@/lib/services/availability";
import { parseDateRange } from "@/lib/time";
import { availabilitySchema } from "@/lib/validation";

export const POST = withAuth(async (req) => {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  const body = availabilitySchema.parse(rawBody);
  const { start, end } = parseDateRange(body.startsAt, body.endsAt);

  const [result, bulkAvailability] = await Promise.all([
    checkAvailability(db, {
      locationId: body.locationId,
      startsAt: start,
      endsAt: end,
      serializedAssetIds: body.serializedAssetIds,
      bulkItems: body.bulkItems,
      excludeBookingId: body.excludeBookingId,
    }),
    getBulkAvailability(db, {
      locationId: body.locationId,
      startsAt: start,
      endsAt: end,
      excludeBookingId: body.excludeBookingId,
    }),
  ]);

  return ok({ ...result, bulkAvailability });
});
