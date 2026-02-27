export const runtime = "edge";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) {
      throw new HttpError(400, "from and to are required");
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const where: Prisma.BookingWhereInput = {
      startsAt: { lt: toDate },
      endsAt: { gt: fromDate },
      ...(searchParams.get("location_id") ? { locationId: searchParams.get("location_id")! } : {}),
      ...(searchParams.get("asset_id")
        ? {
            serializedItems: {
              some: {
                assetId: searchParams.get("asset_id")!
              }
            }
          }
        : {})
    };

    const data = await db.booking.findMany({
      where,
      include: {
        location: true,
        requester: {
          select: { id: true, name: true, email: true }
        },
        serializedItems: {
          include: {
            asset: true
          }
        },
        bulkItems: {
          include: {
            bulkSku: true
          }
        }
      },
      orderBy: { startsAt: "asc" }
    });

    return ok({ data });
  } catch (error) {
    return fail(error);
  }
}
