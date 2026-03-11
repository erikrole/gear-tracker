export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { randomHex } from "@/lib/crypto";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      throw new HttpError(403, "Forbidden");
    }

    const { id } = await ctx.params;
    const source = await db.asset.findUnique({ where: { id } });
    if (!source) throw new HttpError(404, "Asset not found");

    const suffix = randomHex(3).toUpperCase();
    const newTag = `${source.assetTag}-COPY-${suffix}`;
    const newSerial = `${source.serialNumber}-COPY-${suffix}`;
    const newQr = `QR-${randomHex(8).toUpperCase()}`;

    const duplicate = await db.asset.create({
      data: {
        assetTag: newTag,
        name: source.name,
        type: source.type,
        brand: source.brand,
        model: source.model,
        serialNumber: newSerial,
        qrCodeValue: newQr,
        purchaseDate: source.purchaseDate,
        purchasePrice: source.purchasePrice,
        warrantyDate: source.warrantyDate,
        residualValue: source.residualValue,
        locationId: source.locationId,
        departmentId: source.departmentId,
        categoryId: source.categoryId,
        status: "AVAILABLE",
        consumable: source.consumable,
        imageUrl: source.imageUrl,
        notes: source.notes,
        linkUrl: source.linkUrl,
        availableForReservation: source.availableForReservation,
        availableForCheckout: source.availableForCheckout,
        availableForCustody: source.availableForCustody,
      },
      include: { location: true, category: true },
    });

    await db.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "asset",
        entityId: duplicate.id,
        action: "duplicated",
        afterJson: { sourceId: id, assetTag: newTag },
      },
    });

    return ok({ data: duplicate }, 201);
  } catch (error) {
    return fail(error);
  }
}
