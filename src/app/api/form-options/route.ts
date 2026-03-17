import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { DEFAULT_LOCATIONS } from "@/lib/default-locations";
import { deriveAssetStatuses } from "@/lib/services/status";

export const GET = withAuth(async () => {
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
        id: true, assetTag: true, name: true, brand: true, model: true,
        serialNumber: true, type: true, status: true, locationId: true,
        qrCodeValue: true, primaryScanCode: true,
        location: { select: { id: true, name: true } },
        category: { select: { name: true } }
      }
    }),
    db.bulkSku.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, unit: true, locationId: true, binQrCodeValue: true, categoryRel: { select: { name: true } } }
    })
  ]);

  // Enrich assets with computed status (CHECKED_OUT, RESERVED, etc.)
  const statusMap = await deriveAssetStatuses(availableAssets.map((a) => a.id));

  // Flatten category name onto assets and bulkSkus for equipment section classification
  const assetsWithCategory = availableAssets.map((a) => ({
    ...a,
    computedStatus: statusMap.get(a.id) ?? a.status,
    categoryName: a.category?.name ?? null,
    category: undefined,
  }));
  const bulkSkusFlat = bulkSkus.map((s) => ({
    ...s,
    categoryName: s.categoryRel?.name ?? null,
    categoryRel: undefined,
  }));

  return ok({ data: { locations, users, availableAssets: assetsWithCategory, bulkSkus: bulkSkusFlat } });
});
