export const runtime = "edge";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { checkAvailability } from "@/lib/services/availability";
import { parseDateRange } from "@/lib/time";
import { availabilitySchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
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
  } catch (error) {
    return fail(error);
  }
}
