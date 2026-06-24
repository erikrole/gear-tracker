import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { visibleUserWhere } from "@/lib/user-visibility";

export const GET = withAuth(async (_req, { user }) => {
  const [locations, departments, users, bulkSkus] = await Promise.all([
    db.location.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({
      where: {
        AND: [
          visibleUserWhere(user),
          user.role === "STUDENT" ? { id: user.id, active: true } : { active: true },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarUrl: true },
    }),
    db.bulkSku.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, category: true, unit: true, locationId: true, binQrCodeValue: true, trackByNumber: true,
        imageUrl: true,
        minThreshold: true,
        categoryRel: { select: { name: true } },
        balances: { select: { onHandQuantity: true } },
        // Available units count for numbered SKUs
        units: { where: { status: "AVAILABLE" }, select: { id: true } },
      }
    })
  ]);

  const bulkSkusFlat = bulkSkus.map((s) => {
    const onHandQuantity = s.balances.reduce((sum, b) => sum + b.onHandQuantity, 0);
    const availableQuantity = s.trackByNumber
      ? s.units.length
      : Math.max(0, onHandQuantity);
    return {
      id: s.id, name: s.name, category: s.category, unit: s.unit,
      locationId: s.locationId, binQrCodeValue: s.binQrCodeValue, trackByNumber: s.trackByNumber,
      imageUrl: s.imageUrl,
      minThreshold: s.minThreshold,
      categoryName: s.categoryRel?.name ?? null,
      currentQuantity: onHandQuantity,
      availableQuantity,
    };
  });

  return ok({ data: { locations, departments, users, bulkSkus: bulkSkusFlat } });
});
