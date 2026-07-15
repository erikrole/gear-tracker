import { Prisma } from "@prisma/client";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { createAuditEntryTx } from "@/lib/audit";
import { generateAssetQrCode } from "@/lib/asset-qr-code";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

const replaceQrCodeSchema = z.object({
  value: z.string().trim().min(1).max(500).optional(),
}).strict();

const MAX_GENERATION_ATTEMPTS = 5;

class QrCollisionError extends Error {}

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "edit");
  const body = replaceQrCodeSchema.parse(await req.json());
  const generated = body.value === undefined;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = body.value ?? generateAssetQrCode();

    try {
      const updated = await db.$transaction(async (tx) => {
        const before = await tx.bulkSku.findUnique({
          where: { id: params.id },
          select: { id: true, name: true, binQrCodeValue: true },
        });
        if (!before) throw new HttpError(404, "Item family not found");
        if (before.binQrCodeValue.toLowerCase() === candidate.toLowerCase()) {
          if (generated) throw new QrCollisionError();
          throw new HttpError(400, "This item family already uses that QR code");
        }

        const [familyCollision, assetCollision] = await Promise.all([
          tx.bulkSku.findFirst({
            where: {
              id: { not: params.id },
              binQrCodeValue: { equals: candidate, mode: "insensitive" },
            },
            select: { id: true },
          }),
          tx.asset.findFirst({
            where: {
              OR: [
                { qrCodeValue: { equals: candidate, mode: "insensitive" } },
                { primaryScanCode: { equals: candidate, mode: "insensitive" } },
                { assetTag: { equals: candidate, mode: "insensitive" } },
              ],
            },
            select: { id: true },
          }),
        ]);

        if (familyCollision || assetCollision) {
          if (generated) throw new QrCollisionError();
          throw new HttpError(409, "QR code already belongs to another item");
        }

        const sku = await tx.bulkSku.update({
          where: { id: params.id },
          data: { binQrCodeValue: candidate },
          select: { id: true, name: true, binQrCodeValue: true },
        });

        await createAuditEntryTx(tx, {
          actorId: user.id,
          actorRole: user.role,
          entityType: "bulk_sku",
          entityId: params.id,
          action: generated ? "qr_generated" : "qr_changed",
          before: { binQrCodeValue: before.binQrCodeValue },
          after: { binQrCodeValue: candidate },
        });

        return sku;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return ok({ data: updated });
    } catch (error) {
      const serializationConflict = error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2034";
      if (serializationConflict && attempt < MAX_GENERATION_ATTEMPTS - 1) continue;

      const retryableGenerationCollision = generated
        && (
          error instanceof QrCollisionError
          || (
            error instanceof Prisma.PrismaClientKnownRequestError
            && error.code === "P2002"
          )
        );
      if (retryableGenerationCollision) continue;

      if (
        !generated
        && error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2002"
      ) {
        throw new HttpError(409, "QR code already belongs to another item");
      }
      throw error;
    }
  }

  throw new HttpError(500, "Could not generate a unique QR code. Try again.");
});
