import { db } from "@/lib/db";
import { withKiosk } from "@/lib/api";
import { HttpError, ok } from "@/lib/http";

/** Get a student's active checkouts, pending pickups, and upcoming reservations */
export const GET = withKiosk<{ userId: string }>(async (_req, { kiosk, params }) => {
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { id: true, active: true, locationId: true },
  });

  if (!user || !user.active) {
    throw new HttpError(404, "User not found");
  }

  // Location scoping: a user with a non-null locationId must match this kiosk.
  // Users with `locationId = null` are treated as global (transitional).
  // See docs/DECISIONS.md — "Kiosk operates within `kiosk.locationId`".
  if (user.locationId !== null && user.locationId !== kiosk.locationId) {
    throw new HttpError(404, "User not found");
  }

  const now = new Date();

  const [checkouts, pendingPickups, reservations] = await Promise.all([
    // Active checkouts (OPEN)
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

    // Pending pickups (PENDING_PICKUP)
    db.booking.findMany({
      where: {
        requesterUserId: params.userId,
        kind: "CHECKOUT",
        status: "PENDING_PICKUP",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        refNumber: true,
        startsAt: true,
        serializedItems: {
          select: {
            asset: {
              select: { id: true, assetTag: true, name: true },
            },
          },
        },
        bulkItems: {
          select: {
            plannedQuantity: true,
            bulkSku: { select: { name: true } },
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
    pendingPickups: pendingPickups.map((p) => ({
      id: p.id,
      title: p.title,
      refNumber: p.refNumber,
      startsAt: p.startsAt,
      serializedItems: p.serializedItems.map((si) => ({
        id: si.asset.id,
        tagName: si.asset.assetTag,
        name: si.asset.name || si.asset.assetTag,
      })),
      bulkItems: p.bulkItems.map((bi) => ({
        name: bi.bulkSku.name,
        quantity: bi.plannedQuantity,
      })),
    })),
    reservations: reservations.map((r) => ({
      id: r.id,
      title: r.title,
      startsAt: r.startsAt,
    })),
  });
});
