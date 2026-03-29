import { withAuth } from "@/lib/api";
import { randomHex } from "@/lib/crypto";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "duplicate");

  const { id } = params;
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

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: duplicate.id,
    action: "duplicated",
    after: { sourceId: id, assetTag: newTag },
  });

  return ok({ data: duplicate }, 201);
});
