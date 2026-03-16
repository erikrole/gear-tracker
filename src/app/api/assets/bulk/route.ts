export const runtime = "edge";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

const bulkSchema = z
  .object({
    ids: z.array(z.string().cuid()).min(1).max(50),
    action: z.enum(["move_location", "change_category", "retire", "maintenance"]),
    locationId: z.string().cuid().optional(),
    categoryId: z.string().cuid().nullable().optional(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
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
      for (const asset of assets) {
        if (asset.locationId !== body.locationId) {
          await createAuditEntry({
            actorId: user.id,
            actorRole: user.role,
            entityType: "asset",
            entityId: asset.id,
            action: "bulk_move_location",
            before: { locationId: asset.locationId },
            after: { locationId: body.locationId! },
          });
        }
      }
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

      for (const asset of assets) {
        if (asset.categoryId !== (body.categoryId ?? null)) {
          await createAuditEntry({
            actorId: user.id,
            actorRole: user.role,
            entityType: "asset",
            entityId: asset.id,
            action: "bulk_change_category",
            before: { categoryId: asset.categoryId },
            after: { categoryId: body.categoryId ?? null },
          });
        }
      }
    } else if (action === "retire") {
      const result = await db.asset.updateMany({
        where: { id: { in: ids }, status: { not: "RETIRED" } },
        data: { status: "RETIRED" },
      });
      updated = result.count;

      for (const asset of assets) {
        if (asset.status !== "RETIRED") {
          await createAuditEntry({
            actorId: user.id,
            actorRole: user.role,
            entityType: "asset",
            entityId: asset.id,
            action: "bulk_retired",
            before: { status: asset.status },
            after: { status: "RETIRED" },
          });
        }
      }
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

      for (const asset of assets) {
        const newStatus = asset.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE";
        await createAuditEntry({
          actorId: user.id,
          actorRole: user.role,
          entityType: "asset",
          entityId: asset.id,
          action: newStatus === "MAINTENANCE" ? "bulk_marked_maintenance" : "bulk_cleared_maintenance",
          before: { status: asset.status },
          after: { status: newStatus },
        });
      }
    }

    return ok({ updated });
  } catch (error) {
    return fail(error);
  }
}
