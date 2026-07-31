import { z } from "zod";
import { BookingKind, BookingStatus, Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { enforceRateLimit, SETTINGS_MUTATION_LIMIT } from "@/lib/rate-limit";
import { apnsTokenSchema } from "@/lib/validation";

const registerSchema = z.object({
  bookingId: z.string().min(1).max(128),
  token: apnsTokenSchema,
});

const CHECKOUT_RETURN_ACTIVITY = "checkout_return";
const MAX_ACTIVE_TOKENS_PER_BOOKING = 4;

export const POST = withAuth(async (req, { user }) => {
  await enforceRateLimit(
    `live-activities:checkout-return:register:${user.id}`,
    SETTINGS_MUTATION_LIMIT,
  );
  const body = registerSchema.parse(await req.json());
  const now = new Date();
  await db.$transaction(async (tx) => {
    const activeUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { active: true },
    });
    if (!activeUser?.active) {
      throw new HttpError(401, "Account deactivated");
    }

    const booking = await tx.booking.findUnique({
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

    await tx.liveActivityToken.updateMany({
      where: {
        userId: user.id,
        activity: CHECKOUT_RETURN_ACTIVITY,
        bookingId: { not: booking.id },
        endedAt: null,
      },
      data: { endedAt: now },
    });
    await tx.liveActivityToken.upsert({
      where: { token: body.token },
      update: {
        userId: user.id,
        bookingId: booking.id,
        activity: CHECKOUT_RETURN_ACTIVITY,
        lastSeenAt: now,
        endedAt: null,
      },
      create: {
        userId: user.id,
        bookingId: booking.id,
        token: body.token,
        activity: CHECKOUT_RETURN_ACTIVITY,
      },
    });

    // ActivityKit can rotate a token while an activity is live. Retain a small
    // newest-first overlap window, then end every older active token in one
    // bounded write so a long-running checkout cannot grow without limit.
    const kept = await tx.liveActivityToken.findMany({
      where: {
        userId: user.id,
        bookingId: body.bookingId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        endedAt: null,
      },
      orderBy: [
        { lastSeenAt: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: MAX_ACTIVE_TOKENS_PER_BOOKING,
      select: { id: true },
    });
    await tx.liveActivityToken.updateMany({
      where: {
        userId: user.id,
        bookingId: body.bookingId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        endedAt: null,
        id: { notIn: kept.map((row) => row.id) },
      },
      data: { endedAt: now },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ success: true });
});
