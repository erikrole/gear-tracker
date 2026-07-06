import { BookingStatus, BulkMovementKind, BulkUnitStatus, Prisma } from "@prisma/client";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { updateBulkUnitSchema } from "@/lib/validation";
import { createAuditEntry } from "@/lib/audit";
import { effectiveBulkUnitStatus } from "@/lib/bulk-unit-status";

export const PATCH = withAuth<{ id: string; unitNumber: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "adjust");
  const { id, unitNumber: unitNumStr } = params;
  const unitNumber = parseInt(unitNumStr, 10);
  if (isNaN(unitNumber)) throw new HttpError(400, "Invalid unit number");

  const body = updateBulkUnitSchema.parse(await req.json());

  const result = await db.$transaction(async (tx) => {
    const unit = await tx.bulkSkuUnit.findUnique({
      where: { bulkSkuId_unitNumber: { bulkSkuId: id, unitNumber } },
      include: {
        allocations: {
          where: {
            checkedOutAt: { not: null },
            checkedInAt: null,
          },
          take: 1,
        },
      },
    });
    if (!unit) throw new HttpError(404, "Unit not found");

    const effectiveStatus = effectiveBulkUnitStatus(unit, unit.allocations[0]);

    if (effectiveStatus === BulkUnitStatus.CHECKED_OUT) {
      throw new HttpError(
        409,
        "Cannot change a checked-out unit. Check it in first."
      );
    }

    const before = { status: unit.status, notes: unit.notes };

    // Returning a unit to service: close any lingering active allocation from
    // a booking that is no longer open (historic LOST-with-open-allocation
    // drift). Without this, flipping a found battery LOST→AVAILABLE leaves an
    // open allocation that makes its effective status read "checked out on
    // another booking" forever — and repair-stale can't fix that shape.
    if (body.status === "AVAILABLE") {
      await tx.bookingBulkUnitAllocation.updateMany({
        where: {
          bulkSkuUnitId: unit.id,
          checkedOutAt: { not: null },
          checkedInAt: null,
          bookingBulkItem: {
            booking: { status: { notIn: [BookingStatus.OPEN, BookingStatus.PENDING_PICKUP] } },
          },
        },
        data: { checkedInAt: new Date() },
      });
    }

    const updated = await tx.bulkSkuUnit.update({
      where: { id: unit.id },
      data: {
        status: body.status as BulkUnitStatus,
        notes: body.notes ?? unit.notes
      }
    });

    // Adjust on-hand balance when taking a unit out of / back into service
    const wasAvailable = effectiveStatus === BulkUnitStatus.AVAILABLE;
    const isAvailable = body.status === "AVAILABLE";

    const availabilityChanged = wasAvailable !== isAvailable;
    if (availabilityChanged) {
      const sku = await tx.bulkSku.findUniqueOrThrow({ where: { id } });
      const reason = body.reason ?? `Unit #${unitNumber} marked ${body.status.toLowerCase()}`;

      await tx.bulkStockMovement.create({
        data: {
          bulkSkuId: id,
          locationId: sku.locationId,
          actorUserId: user.id,
          kind: BulkMovementKind.ADJUSTMENT,
          quantity: 1,
          reason,
        }
      });

      if (wasAvailable && !isAvailable) {
        await tx.bulkStockBalance.update({
          where: {
            bulkSkuId_locationId: { bulkSkuId: id, locationId: sku.locationId }
          },
          data: { onHandQuantity: { decrement: 1 } }
        });
      } else {
        await tx.bulkStockBalance.update({
          where: {
            bulkSkuId_locationId: { bulkSkuId: id, locationId: sku.locationId }
          },
          data: { onHandQuantity: { increment: 1 } }
        });
      }
    }

    return { before, updated, reason: body.reason ?? null };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "bulk_sku_unit",
    entityId: `${id}#${unitNumber}`,
    action: "update_status",
    before: result.before,
    after: { status: result.updated.status, notes: result.updated.notes, reason: result.reason },
  });

  return ok({ data: result.updated });
});
