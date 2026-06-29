import { z } from "zod";
import { BookingKind, BookingStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { registerCheckoutReturnLiveActivity } from "@/lib/services/live-activities";

const registerSchema = z.object({
  bookingId: z.string().min(1),
  token: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = registerSchema.parse(await req.json());
    const booking = await db.booking.findUnique({
      where: { id: body.bookingId },
      select: {
        id: true,
        kind: true,
        status: true,
        requesterUserId: true,
      },
    });

    if (!booking || booking.kind !== BookingKind.CHECKOUT) {
      throw new HttpError(404, "Checkout not found");
    }
    if (booking.requesterUserId !== user.id) {
      throw new HttpError(403, "Live Activity is only available for your checkout");
    }
    if (booking.status !== BookingStatus.OPEN) {
      throw new HttpError(400, "Live Activity requires an open checkout");
    }

    await registerCheckoutReturnLiveActivity({
      userId: user.id,
      bookingId: booking.id,
      token: body.token,
    });

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
