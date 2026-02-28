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

    const [locations, users, availableAssets] = await Promise.all([
      db.location.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
      db.asset.findMany({
        where: { status: "AVAILABLE" },
        orderBy: { assetTag: "asc" },
        select: { id: true, assetTag: true, brand: true, model: true, locationId: true }
      })
    ]);

    return ok({ data: { locations, users, availableAssets } });
  } catch (error) {
    return fail(error);
  }
}
