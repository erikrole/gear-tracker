export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createBulkSkuSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get("location_id");

    const data = await db.bulkSku.findMany({
      where: {
        ...(locationId ? { locationId } : {})
      },
      include: {
        location: true,
        balances: true
      },
      orderBy: [{ locationId: "asc" }, { name: "asc" }]
    });

    return ok({ data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "bulk_sku", "create");
    const body = createBulkSkuSchema.parse(await req.json());

    const result = await db.$transaction(async (tx) => {
      const sku = await tx.bulkSku.create({
        data: {
          name: body.name,
          category: body.category,
          unit: body.unit,
          locationId: body.locationId,
          binQrCodeValue: body.binQrCodeValue,
          minThreshold: body.minThreshold,
          active: body.active
        }
      });

      await tx.bulkStockBalance.create({
        data: {
          bulkSkuId: sku.id,
          locationId: body.locationId,
          onHandQuantity: body.initialQuantity
        }
      });

      if (body.initialQuantity > 0) {
        await tx.bulkStockMovement.create({
          data: {
            bulkSkuId: sku.id,
            locationId: body.locationId,
            actorUserId: actor.id,
            kind: "ADJUSTMENT",
            quantity: body.initialQuantity,
            reason: "Initial quantity"
          }
        });
      }

      return tx.bulkSku.findUniqueOrThrow({
        where: { id: sku.id },
        include: { balances: true }
      });
    });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "bulk_sku",
      entityId: result.id,
      action: "create",
      after: { name: body.name, initialQuantity: body.initialQuantity },
    });

    return ok({ data: result }, 201);
  } catch (error) {
    return fail(error);
  }
}
