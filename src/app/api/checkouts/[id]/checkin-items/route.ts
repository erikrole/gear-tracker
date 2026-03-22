import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { checkinItems } from "@/lib/services/bookings";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";

const checkinItemsSchema = z.object({
  assetIds: z.array(z.string().cuid()).min(1),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = checkinItemsSchema.parse(await req.json());

  await requireBookingAction(id, user, "checkin", BookingKind.CHECKOUT);

  // Audit entry is created inside checkinItems() within the SERIALIZABLE transaction
  const result = await checkinItems(id, user.id, body.assetIds);

  return ok({ data: result });
});
