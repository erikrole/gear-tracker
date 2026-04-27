import { Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createBulkSkuSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("location_id");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const where: Prisma.BulkSkuWhereInput = {
    ...(locationId ? { locationId } : {}),
  };

  const [raw, total] = await Promise.all([
    db.bulkSku.findMany({
      where,
      include: {
        location: true,
        balances: true,
        units: {
          select: {
            id: true,
            unitNumber: true,
            status: true,
          },
        },
        categoryRel: { select: { id: true, name: true } },
        // Active checkout quantities for available-now calculation
        bookingItems: {
          where: {
            booking: { status: "OPEN", kind: "CHECKOUT" },
          },
          select: { checkedOutQuantity: true },
        },
      },
      orderBy: [{ locationId: "asc" }, { name: "asc" }],
      take: limit,
      skip: offset,
    }),
    db.bulkSku.count({ where }),
  ]);

  // Compute availableQuantity: numbered → AVAILABLE units; non-numbered → onHand minus checked-out
  const data = raw.map((sku) => {
    const onHand = sku.balances.reduce((s, b) => s + b.onHandQuantity, 0);
    const availableQuantity = sku.trackByNumber
      ? sku.units.filter((u) => u.status === "AVAILABLE").length
      : Math.max(0, onHand - sku.bookingItems.reduce((s, b) => s + (b.checkedOutQuantity ?? 0), 0));
    const { bookingItems: _, ...rest } = sku;
    return { ...rest, availableQuantity };
  });

  return ok({ data, total, limit, offset });
});

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "bulk_sku", "create");
  const body = createBulkSkuSchema.parse(await req.json());

  const result = await db.$transaction(async (tx) => {
    const sku = await tx.bulkSku.create({
      data: {
        name: body.name,
        category: body.category,
        categoryId: body.categoryId ?? null,
        unit: body.unit,
        locationId: body.locationId,
        binQrCodeValue: body.binQrCodeValue,
        minThreshold: body.minThreshold,
        trackByNumber: body.trackByNumber,
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
          actorUserId: user.id,
          kind: "ADJUSTMENT",
          quantity: body.initialQuantity,
          reason: "Initial quantity"
        }
      });
    }

    if (body.trackByNumber && body.initialQuantity > 0) {
      await tx.bulkSkuUnit.createMany({
        data: Array.from({ length: body.initialQuantity }, (_, i) => ({
          bulkSkuId: sku.id,
          unitNumber: i + 1
        }))
      });
    }

    return tx.bulkSku.findUniqueOrThrow({
      where: { id: sku.id },
      include: { balances: true, units: body.trackByNumber }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku",
    entityId: result.id,
    action: "create",
    after: { name: body.name, initialQuantity: body.initialQuantity },
  });

  return ok({ data: result }, 201);
});
