import { db } from "@/lib/db";
import { endCheckoutReturnLiveActivityTokens } from "@/lib/push/apns";

const CHECKOUT_RETURN_ACTIVITY = "checkout_return";

export async function registerCheckoutReturnLiveActivity(args: {
  userId: string;
  bookingId: string;
  token: string;
}) {
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.liveActivityToken.updateMany({
      where: {
        userId: args.userId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        bookingId: { not: args.bookingId },
        endedAt: null,
      },
      data: { endedAt: now },
    });

    await tx.liveActivityToken.upsert({
      where: { token: args.token },
      update: {
        userId: args.userId,
        bookingId: args.bookingId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        lastSeenAt: now,
        endedAt: null,
      },
      create: {
        userId: args.userId,
        bookingId: args.bookingId,
        token: args.token,
        activity: CHECKOUT_RETURN_ACTIVITY,
      },
    });
  });
}

export async function endCheckoutReturnLiveActivities(bookingId: string) {
  try {
    const rows = await db.liveActivityToken.findMany({
      where: {
        bookingId,
        activity: CHECKOUT_RETURN_ACTIVITY,
        endedAt: null,
      },
      select: { token: true },
    });

    if (rows.length === 0) return;

    const tokens = rows.map((row) => row.token);
    const { revoked } = await endCheckoutReturnLiveActivityTokens(tokens);
    const endedAt = new Date();

    await db.liveActivityToken.updateMany({
      where: { token: { in: tokens } },
      data: { endedAt },
    });

    if (revoked.length > 0) {
      await db.liveActivityToken.updateMany({
        where: { token: { in: revoked } },
        data: { endedAt },
      });
    }
  } catch (error) {
    console.error("[LiveActivity] failed to end checkout return activity", {
      bookingId,
      error,
    });
  }
}
