import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";

/** Get a student's active checkouts and upcoming reservations */
export const GET = withKiosk<{ userId: string }>(async (_req, { params }) => {
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { id: true, active: true },
  });

  if (!user || !user.active) {
    throw new HttpError(404, "User not found");
  }

  const now = new Date();

  const [checkouts, reservations] = await Promise.all([
    // Active checkouts
    db.booking.findMany({
      where: {
        requesterUserId: params.userId,
        kind: "CHECKOUT",
        status: "OPEN",
      },
      orderBy: { endsAt: "asc" },
      select: {
        id: true,
        title: true,
        refNumber: true,
        endsAt: true,
        serializedItems: {
          where: { allocationStatus: "active" },
          select: {
            asset: {
              select: { assetTag: true, name: true },
            },
          },
        },
      },
    }),

    // Upcoming reservations (next 7 days)
    db.booking.findMany({
      where: {
        requesterUserId: params.userId,
        kind: "RESERVATION",
        status: "BOOKED",
        startsAt: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        startsAt: true,
      },
    }),
  ]);

  return ok({
    checkouts: checkouts.map((c) => ({
      id: c.id,
      title: c.title,
      refNumber: c.refNumber,
      items: c.serializedItems.map((si) => ({
        name: si.asset.name || si.asset.assetTag,
        tagName: si.asset.assetTag,
      })),
      endsAt: c.endsAt,
      isOverdue: c.endsAt < now,
    })),
    reservations: reservations.map((r) => ({
      id: r.id,
      title: r.title,
      startsAt: r.startsAt,
    })),
  });
});
