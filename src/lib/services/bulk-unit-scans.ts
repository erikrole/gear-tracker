import { BookingKind, BookingStatus, BulkUnitStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseDerivedBulkUnitQr } from "@/lib/bulk-unit-qr";
import { HttpError } from "@/lib/http";

type TxClient = Prisma.TransactionClient;

type BulkUnitScanItem = {
  id: string;
  name: string;
  tagName: string;
  type: string;
  unitNumber: number;
  bulkSkuId: string;
};

type KioskUnitScanResult =
  | { handled: false }
  | { handled: true; success: true; item: BulkUnitScanItem }
  | { handled: true; success: false; error: string };

function unitDisplayName(skuName: string, unitNumber: number) {
  return `${skuName} #${unitNumber}`;
}

function unitTagName(unitNumber: number) {
  return `#${unitNumber}`;
}

export async function scanKioskPickupBulkUnit(
  tx: TxClient,
  args: { bookingId: string; scanValue: string },
): Promise<KioskUnitScanResult> {
  const booking = await tx.booking.findUnique({
    where: { id: args.bookingId },
    include: {
      bulkItems: { include: { bulkSku: true } },
    },
  });

  if (
    !booking ||
    booking.kind !== BookingKind.CHECKOUT ||
    booking.status !== BookingStatus.PENDING_PICKUP
  ) {
    throw new HttpError(404, "Pending pickup not found");
  }

  const derived = parseDerivedBulkUnitQr(
    args.scanValue,
    booking.bulkItems.map((item) => item.bulkSku),
  );
  if (!derived) return { handled: false };

  const bulkItem = booking.bulkItems.find((item) => item.bulkSkuId === derived.bulkSkuId);
  if (!bulkItem || !bulkItem.bulkSku.trackByNumber) {
    return { handled: true, success: false, error: "Battery unit is not in this checkout" };
  }

  const unit = await tx.bulkSkuUnit.findUnique({
    where: {
      bulkSkuId_unitNumber: {
        bulkSkuId: bulkItem.bulkSkuId,
        unitNumber: derived.unitNumber,
      },
    },
  });
  if (!unit) {
    return { handled: true, success: false, error: `${bulkItem.bulkSku.name} #${derived.unitNumber} does not exist` };
  }

  const existingAllocation = await tx.bookingBulkUnitAllocation.findUnique({
    where: {
      bookingBulkItemId_bulkSkuUnitId: {
        bookingBulkItemId: bulkItem.id,
        bulkSkuUnitId: unit.id,
      },
    },
  });
  if (existingAllocation?.checkedOutAt) {
    return { handled: true, success: false, error: `${bulkItem.bulkSku.name} #${unit.unitNumber} already scanned` };
  }

  const checkedOutQuantity = bulkItem.checkedOutQuantity ?? 0;
  if (checkedOutQuantity >= bulkItem.plannedQuantity) {
    return {
      handled: true,
      success: false,
      error: `${bulkItem.bulkSku.name} already has ${bulkItem.plannedQuantity} of ${bulkItem.plannedQuantity} units scanned`,
    };
  }

  if (unit.status !== BulkUnitStatus.AVAILABLE) {
    return {
      handled: true,
      success: false,
      error: `${bulkItem.bulkSku.name} #${unit.unitNumber} is ${unit.status.replace(/_/g, " ").toLowerCase()}`,
    };
  }

  const now = new Date();
  await tx.bookingBulkUnitAllocation.create({
    data: {
      bookingBulkItemId: bulkItem.id,
      bulkSkuUnitId: unit.id,
      checkedOutAt: now,
    },
  });
  await tx.bulkSkuUnit.update({
    where: { id: unit.id },
    data: { status: BulkUnitStatus.CHECKED_OUT },
  });
  await tx.bookingBulkItem.update({
    where: { id: bulkItem.id },
    data: { checkedOutQuantity: { increment: 1 } },
  });

  return {
    handled: true,
    success: true,
    item: {
      id: `${bulkItem.id}:slot:${checkedOutQuantity + 1}`,
      name: unitDisplayName(bulkItem.bulkSku.name, unit.unitNumber),
      tagName: unitTagName(unit.unitNumber),
      type: bulkItem.bulkSku.category,
      unitNumber: unit.unitNumber,
      bulkSkuId: bulkItem.bulkSkuId,
    },
  };
}

export async function scanKioskCheckinBulkUnit(
  tx: TxClient,
  args: { bookingId: string; scanValue: string },
): Promise<KioskUnitScanResult> {
  const booking = await tx.booking.findUnique({
    where: { id: args.bookingId },
    include: {
      bulkItems: { include: { bulkSku: true } },
    },
  });

  if (
    !booking ||
    booking.kind !== BookingKind.CHECKOUT ||
    booking.status !== BookingStatus.OPEN
  ) {
    throw new HttpError(404, "Active checkout not found");
  }

  const derived = parseDerivedBulkUnitQr(
    args.scanValue,
    booking.bulkItems.map((item) => item.bulkSku),
  );
  if (!derived) return { handled: false };

  const bulkItem = booking.bulkItems.find((item) => item.bulkSkuId === derived.bulkSkuId);
  if (!bulkItem || !bulkItem.bulkSku.trackByNumber) {
    return { handled: true, success: false, error: "Battery unit is not in this checkout" };
  }

  const unit = await tx.bulkSkuUnit.findUnique({
    where: {
      bulkSkuId_unitNumber: {
        bulkSkuId: bulkItem.bulkSkuId,
        unitNumber: derived.unitNumber,
      },
    },
  });
  if (!unit) {
    return { handled: true, success: false, error: `${bulkItem.bulkSku.name} #${derived.unitNumber} does not exist` };
  }

  const allocation = await tx.bookingBulkUnitAllocation.findUnique({
    where: {
      bookingBulkItemId_bulkSkuUnitId: {
        bookingBulkItemId: bulkItem.id,
        bulkSkuUnitId: unit.id,
      },
    },
  });

  if (!allocation || !allocation.checkedOutAt) {
    return { handled: true, success: false, error: `${bulkItem.bulkSku.name} #${unit.unitNumber} is not checked out on this booking` };
  }
  if (allocation.checkedInAt) {
    return { handled: true, success: false, error: `${bulkItem.bulkSku.name} #${unit.unitNumber} already returned` };
  }

  const now = new Date();
  await tx.bookingBulkUnitAllocation.update({
    where: { id: allocation.id },
    data: { checkedInAt: now },
  });
  await tx.bulkSkuUnit.update({
    where: { id: unit.id },
    data: { status: BulkUnitStatus.AVAILABLE },
  });
  await tx.bookingBulkItem.update({
    where: { id: bulkItem.id },
    data: { checkedInQuantity: { increment: 1 } },
  });

  return {
    handled: true,
    success: true,
    item: {
      id: unit.id,
      name: unitDisplayName(bulkItem.bulkSku.name, unit.unitNumber),
      tagName: unitTagName(unit.unitNumber),
      type: bulkItem.bulkSku.category,
      unitNumber: unit.unitNumber,
      bulkSkuId: bulkItem.bulkSkuId,
    },
  };
}

export async function findBulkUnitByScanValue(scanValue: string) {
  const skus = await db.bulkSku.findMany({
    where: { trackByNumber: true, active: true },
    select: { id: true, binQrCodeValue: true, trackByNumber: true },
  });
  const derived = parseDerivedBulkUnitQr(scanValue, skus);
  if (!derived) return null;

  const unit = await db.bulkSkuUnit.findUnique({
    where: {
      bulkSkuId_unitNumber: {
        bulkSkuId: derived.bulkSkuId,
        unitNumber: derived.unitNumber,
      },
    },
    include: {
      bulkSku: {
        select: {
          id: true,
          name: true,
          category: true,
          active: true,
        },
      },
    },
  });
  if (!unit || !unit.bulkSku.active) return null;

  const activeAllocation = await db.bookingBulkUnitAllocation.findFirst({
    where: {
      bulkSkuUnitId: unit.id,
      checkedOutAt: { not: null },
      checkedInAt: null,
    },
    select: {
      bookingBulkItem: {
        select: {
          booking: {
            select: {
              title: true,
              endsAt: true,
              requester: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { checkedOutAt: "desc" },
  });

  const booking = activeAllocation?.bookingBulkItem.booking;

  return {
    id: unit.id,
    name: unitDisplayName(unit.bulkSku.name, unit.unitNumber),
    tagName: unitTagName(unit.unitNumber),
    type: unit.bulkSku.category,
    status: unit.status,
    bulkSkuName: unit.bulkSku.name,
    bulkSkuId: unit.bulkSku.id,
    unitNumber: unit.unitNumber,
    holder: booking?.requester.name,
    dueAt: booking?.endsAt.toISOString(),
    bookingTitle: booking?.title,
  };
}
