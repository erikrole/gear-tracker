import { z } from "zod";
import { withAuth } from "@/lib/api";
import { ok } from "@/lib/http";
import { checkinBulkItem } from "@/lib/services/bookings";
import { BookingKind } from "@prisma/client";
import { requireBookingAction } from "@/lib/services/booking-rules";

const checkinBulkSchema = z.object({
  bulkItemId: z.string().cuid(),
  quantity: z.number().int().min(1),
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  const { id } = params;
  const body = checkinBulkSchema.parse(await req.json());

  await requireBookingAction(id, user, "checkin", BookingKind.CHECKOUT);

  const result = await checkinBulkItem(id, user.id, body.bulkItemId, body.quantity);

  return ok({ data: result });
});
