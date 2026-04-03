import { z } from "zod";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntries } from "@/lib/audit";

const bulkSchema = z
  .object({
    ids: z.array(z.string().cuid()).min(1).max(50),
    action: z.enum(["move_location", "change_category", "retire", "maintenance", "delete", "add_to_kit"]),
    locationId: z.string().cuid().optional(),
    categoryId: z.string().cuid().nullable().optional(),
    kitId: z.string().cuid().optional(),
  })
  .strict();

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "asset", "edit");

  const body = bulkSchema.parse(await req.json());
  const { ids, action } = body;

  // Validate payload requirements
  if (action === "move_location" && !body.locationId) {
    throw new HttpError(400, "locationId required for move_location");
  }
  if (action === "change_category" && body.categoryId === undefined) {
    throw new HttpError(400, "categoryId required for change_category");
  }

  // Fetch all target assets in one query
  const assets = await db.asset.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, locationId: true, categoryId: true },
  });

  if (assets.length === 0) {
    throw new HttpError(404, "No assets found");
  }

  let updated = 0;

  if (action === "move_location") {
    // Verify location exists
    const loc = await db.location.findUnique({ where: { id: body.locationId! } });
    if (!loc) throw new HttpError(404, "Location not found");

    const result = await db.asset.updateMany({
      where: { id: { in: ids } },
      data: { locationId: body.locationId! },
    });
    updated = result.count;

    // Audit each affected asset
    await createAuditEntries(
      assets
        .filter((asset) => asset.locationId !== body.locationId)
        .map((asset) => ({
          actorId: user.id,
          actorRole: user.role,
          entityType: "asset",
          entityId: asset.id,
          action: "bulk_move_location",
          before: { locationId: asset.locationId },
          after: { locationId: body.locationId! },
        }))
    );
  } else if (action === "change_category") {
    if (body.categoryId) {
      const cat = await db.category.findUnique({ where: { id: body.categoryId } });
      if (!cat) throw new HttpError(404, "Category not found");
    }

    const result = await db.asset.updateMany({
      where: { id: { in: ids } },
      data: { categoryId: body.categoryId ?? null },
    });
    updated = result.count;

    await createAuditEntries(
      assets
        .filter((asset) => asset.categoryId !== (body.categoryId ?? null))
        .map((asset) => ({
          actorId: user.id,
          actorRole: user.role,
          entityType: "asset",
          entityId: asset.id,
          action: "bulk_change_category",
          before: { categoryId: asset.categoryId },
          after: { categoryId: body.categoryId ?? null },
        }))
    );
  } else if (action === "retire") {
    const result = await db.asset.updateMany({
      where: { id: { in: ids }, status: { not: "RETIRED" } },
      data: { status: "RETIRED" },
    });
    updated = result.count;

    await createAuditEntries(
      assets
        .filter((asset) => asset.status !== "RETIRED")
        .map((asset) => ({
          actorId: user.id,
          actorRole: user.role,
          entityType: "asset",
          entityId: asset.id,
          action: "bulk_retired",
          before: { status: asset.status },
          after: { status: "RETIRED" },
        }))
    );
  } else if (action === "maintenance") {
    // Toggle: MAINTENANCE → AVAILABLE, others → MAINTENANCE
    const toMaintenance = assets.filter((a) => a.status !== "MAINTENANCE");
    const toAvailable = assets.filter((a) => a.status === "MAINTENANCE");

    const [r1, r2] = await Promise.all([
      toMaintenance.length > 0
        ? db.asset.updateMany({
            where: { id: { in: toMaintenance.map((a) => a.id) } },
            data: { status: "MAINTENANCE" },
          })
        : { count: 0 },
      toAvailable.length > 0
        ? db.asset.updateMany({
            where: { id: { in: toAvailable.map((a) => a.id) } },
            data: { status: "AVAILABLE" },
          })
        : { count: 0 },
    ]);
    updated = r1.count + r2.count;

    await createAuditEntries(
      assets.map((asset) => {
        const newStatus = asset.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE";
        return {
          actorId: user.id,
          actorRole: user.role,
          entityType: "asset",
          entityId: asset.id,
          action: newStatus === "MAINTENANCE" ? "bulk_marked_maintenance" : "bulk_cleared_maintenance",
          before: { status: asset.status },
          after: { status: newStatus },
        };
      })
    );
  } else if (action === "delete") {
    requirePermission(user.role, "asset", "delete");

    // Check for active bookings that would be affected
    const activeBookingCount = await db.assetAllocation.count({
      where: { assetId: { in: ids }, active: true },
    });

    if (activeBookingCount > 0) {
      throw new HttpError(
        409,
        `Cannot delete: ${activeBookingCount} asset(s) have active bookings. Return them first.`
      );
    }

    // Clean up non-cascading relations, then delete assets
    await db.$transaction(async (tx) => {
      await tx.bookingSerializedItem.deleteMany({ where: { assetId: { in: ids } } });
      await tx.assetAllocation.deleteMany({ where: { assetId: { in: ids } } });
      await tx.scanEvent.deleteMany({ where: { assetId: { in: ids } } });
      await tx.checkinItemReport.deleteMany({ where: { assetId: { in: ids } } });
      const result = await tx.asset.deleteMany({ where: { id: { in: ids } } });
      updated = result.count;
    });

    await createAuditEntries(
      assets.map((asset) => ({
        actorId: user.id,
        actorRole: user.role,
        entityType: "asset",
        entityId: asset.id,
        action: "bulk_deleted",
        before: { status: asset.status, locationId: asset.locationId, categoryId: asset.categoryId },
        after: { deleted: true },
      }))
    );
  } else if (action === "add_to_kit") {
    if (!body.kitId) {
      throw new HttpError(400, "kitId required for add_to_kit");
    }

    const kit = await db.kit.findUnique({ where: { id: body.kitId } });
    if (!kit) throw new HttpError(404, "Kit not found");

    // Skip assets already in this kit
    const existing = await db.kitMembership.findMany({
      where: { kitId: body.kitId, assetId: { in: ids } },
      select: { assetId: true },
    });
    const existingIds = new Set(existing.map((e) => e.assetId));
    const newIds = ids.filter((id) => !existingIds.has(id));

    if (newIds.length > 0) {
      await db.kitMembership.createMany({
        data: newIds.map((assetId) => ({ kitId: body.kitId!, assetId })),
      });
    }
    updated = newIds.length;

    await createAuditEntries(
      newIds.map((assetId) => ({
        actorId: user.id,
        actorRole: user.role,
        entityType: "asset",
        entityId: assetId,
        action: "bulk_added_to_kit",
        before: {},
        after: { kitId: body.kitId! },
      }))
    );
  }

  return ok({ updated });
});
