import { randomUUID } from "crypto";
import { BulkUnitStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { createAuditEntryTx } from "@/lib/audit";
import { buildDerivedBulkUnitQrValue } from "@/lib/bulk-unit-qr";
import { csvField } from "@/lib/csv";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import {
  bulkUnitLabelExportQuerySchema,
  markBulkUnitLabelsPrintedSchema,
} from "@/lib/validation";

function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function slugifyFilenamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sku";
}

export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "adjust");
  const query = bulkUnitLabelExportQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));

  const sku = await db.bulkSku.findUnique({
    where: { id: params.id },
    include: {
      units: {
        where: query.scope === "unprinted"
          ? { labelPrintedAt: null, status: { not: BulkUnitStatus.RETIRED } }
          : undefined,
        orderBy: { unitNumber: "asc" },
      },
    },
  });

  if (!sku) throw new HttpError(404, "Bulk SKU not found");
  if (!sku.trackByNumber) throw new HttpError(400, "This SKU does not track by number");

  const binQrCodeValue = sku.binQrCodeValue.trim();
  if (!binQrCodeValue) {
    throw new HttpError(400, "This SKU needs a bin QR code before unit labels can be exported");
  }

  const rows = [
    ["item_number", "qr_code"],
    ...sku.units.map((unit) => [
      String(unit.unitNumber),
      buildDerivedBulkUnitQrValue(binQrCodeValue, unit.unitNumber),
    ]),
  ];
  const body = `${rows.map((row) => row.map(csvField).join(",")).join("\n")}\n`;
  const filename = `brother-labels-${slugifyFilenamePart(sku.name)}-${dateStamp()}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Label-Unit-Numbers": sku.units.map((unit) => unit.unitNumber).join(","),
    },
  });
});

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "adjust");
  const body = markBulkUnitLabelsPrintedSchema.parse(await req.json());
  const batchId = randomUUID();

  const result = await db.$transaction(async (tx) => {
    const sku = await tx.bulkSku.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, trackByNumber: true },
    });
    if (!sku) throw new HttpError(404, "Bulk SKU not found");
    if (!sku.trackByNumber) throw new HttpError(400, "This SKU does not track by number");

    const units = await tx.bulkSkuUnit.findMany({
      where: {
        bulkSkuId: params.id,
        unitNumber: { in: body.unitNumbers },
      },
      select: {
        id: true,
        unitNumber: true,
        status: true,
        labelPrintedAt: true,
      },
      orderBy: { unitNumber: "asc" },
    });

    const foundNumbers = new Set(units.map((unit) => unit.unitNumber));
    const missingNumbers = body.unitNumbers.filter((unitNumber) => !foundNumbers.has(unitNumber));
    if (missingNumbers.length > 0) {
      throw new HttpError(400, "Every unit number must belong to the selected SKU", { missingUnitNumbers: missingNumbers });
    }

    const skippedRetiredNumbers = units
      .filter((unit) => unit.status === BulkUnitStatus.RETIRED)
      .map((unit) => unit.unitNumber);
    const alreadyPrintedNumbers = units
      .filter((unit) => unit.status !== BulkUnitStatus.RETIRED && unit.labelPrintedAt)
      .map((unit) => unit.unitNumber);
    const updateNumbers = units
      .filter((unit) => unit.status !== BulkUnitStatus.RETIRED && !unit.labelPrintedAt)
      .map((unit) => unit.unitNumber);

    if (updateNumbers.length > 0) {
      await tx.bulkSkuUnit.updateMany({
        where: {
          bulkSkuId: params.id,
          unitNumber: { in: updateNumbers },
          status: { not: BulkUnitStatus.RETIRED },
          labelPrintedAt: null,
        },
        data: {
          labelPrintedAt: new Date(),
          labelPrintedById: user.id,
          labelPrintBatchId: batchId,
        },
      });
    }

    const counts = {
      updated: updateNumbers.length,
      alreadyPrinted: alreadyPrintedNumbers.length,
      skippedRetired: skippedRetiredNumbers.length,
    };

    await createAuditEntryTx(tx, {
      actorId: user.id,
      actorRole: user.role,
      entityType: "bulk_sku",
      entityId: params.id,
      action: "mark_unit_labels_printed",
      after: {
        skuId: params.id,
        skuName: sku.name,
        batchId,
        unitNumbers: body.unitNumbers,
        updatedUnitNumbers: updateNumbers,
        alreadyPrintedUnitNumbers: alreadyPrintedNumbers,
        skippedRetiredUnitNumbers: skippedRetiredNumbers,
        counts,
      },
    });

    return { batchId, unitNumbers: body.unitNumbers, ...counts };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return ok({ data: result });
});
