import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { DEFAULT_LOCATIONS } from "@/lib/default-locations";

export const GET = withAuth(async () => {
  await Promise.all(
    DEFAULT_LOCATIONS.map((name) =>
      db.location.upsert({ where: { name }, create: { name }, update: {} })
    )
  );

  const [locations, departments, users, bulkSkus] = await Promise.all([
    db.location.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    db.bulkSku.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, unit: true, locationId: true, binQrCodeValue: true, categoryRel: { select: { name: true } }, balances: { select: { onHandQuantity: true } } }
    })
  ]);

  const bulkSkusFlat = bulkSkus.map((s) => ({
    ...s,
    categoryName: s.categoryRel?.name ?? null,
    currentQuantity: s.balances.reduce((sum, b) => sum + b.onHandQuantity, 0),
    categoryRel: undefined,
    balances: undefined,
  }));

  return ok({ data: { locations, departments, users, bulkSkus: bulkSkusFlat } });
});
