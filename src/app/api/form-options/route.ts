export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { DEFAULT_LOCATIONS } from "@/lib/default-locations";

export async function GET() {
  try {
    await requireAuth();

    await Promise.all(
      DEFAULT_LOCATIONS.map((name) =>
        db.location.upsert({ where: { name }, create: { name }, update: {} })
      )
    );

    const [locations, users, availableAssets, bulkSkus] = await Promise.all([
      db.location.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
      db.asset.findMany({
        where: { status: { not: "RETIRED" } },
        orderBy: { assetTag: "asc" },
        select: {
          id: true, assetTag: true, brand: true, model: true,
          serialNumber: true, type: true, status: true, locationId: true,
          location: { select: { name: true } }
        }
      }),
      db.bulkSku.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, category: true, unit: true, locationId: true }
      })
    ]);

    return ok({ data: { locations, users, availableAssets, bulkSkus } });
  } catch (error) {
    return fail(error);
  }
}
