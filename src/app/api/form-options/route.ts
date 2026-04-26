import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

export const GET = withAuth(async () => {
  const [locations, departments, users, bulkSkus] = await Promise.all([
    db.location.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.department.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, avatarUrl: true } }),
    db.bulkSku.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, category: true, unit: true, locationId: true, binQrCodeValue: true, trackByNumber: true,
        categoryRel: { select: { name: true } },
        balances: { select: { onHandQuantity: true } },
        // Available units count for numbered SKUs
        units: { where: { status: "AVAILABLE" }, select: { id: true } },
        // Active checked-out quantities for non-numbered SKUs
        bookingItems: {
          where: { booking: { status: "OPEN", kind: "CHECKOUT" } },
          select: { checkedOutQuantity: true },
        },
      }
    })
  ]);

  const bulkSkusFlat = bulkSkus.map((s) => {
    const onHandQuantity = s.balances.reduce((sum, b) => sum + b.onHandQuantity, 0);
    const availableQuantity = s.trackByNumber
      ? s.units.length
      : Math.max(0, onHandQuantity - s.bookingItems.reduce((sum, b) => sum + (b.checkedOutQuantity ?? 0), 0));
    return {
      id: s.id, name: s.name, category: s.category, unit: s.unit,
      locationId: s.locationId, binQrCodeValue: s.binQrCodeValue, trackByNumber: s.trackByNumber,
      categoryName: s.categoryRel?.name ?? null,
      currentQuantity: onHandQuantity,
      availableQuantity,
    };
  });

  return ok({ data: { locations, departments, users, bulkSkus: bulkSkusFlat } });
});
