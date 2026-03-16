import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, HttpError } from "@/lib/http";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const asset = await db.asset.findUnique({ where: { id }, select: { id: true } });
    if (!asset) throw new HttpError(404, "Asset not found");

    // Fetch audit logs for this asset + any bookings that included this asset
    const bookingIds = await db.bookingSerializedItem.findMany({
      where: { assetId: id },
      select: { bookingId: true },
      distinct: ["bookingId"],
    });

    const bookingIdList = bookingIds.map((b: { bookingId: string }) => b.bookingId);

    const logs = await db.auditLog.findMany({
      where: {
        OR: [
          { entityType: "asset", entityId: id },
          ...(bookingIdList.length > 0
            ? [{ entityType: "booking", entityId: { in: bookingIdList } }]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: { select: { name: true, email: true } },
      },
    });

    return ok({ data: logs });
  } catch (error) {
    return fail(error);
  }
}
