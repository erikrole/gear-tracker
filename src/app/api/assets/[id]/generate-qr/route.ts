import { withAuth } from "@/lib/api";
import { randomHex } from "@/lib/crypto";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";
import { Prisma } from "@prisma/client";

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "generate_qr");

  const { id } = params;
  const before = await db.asset.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "Asset not found");

  // Generate unique QR code — catch P2002 on collision and retry (no TOCTOU)
  let asset;
  let attempts = 0;
  let qrCode = "";
  while (attempts < 5) {
    qrCode = `QR-${randomHex(8).toUpperCase()}`;
    try {
      asset = await db.asset.update({
        where: { id },
        data: { qrCodeValue: qrCode },
        include: { location: true, category: true },
      });
      break;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        attempts++;
        continue;
      }
      throw err;
    }
  }

  if (!asset) {
    throw new HttpError(500, "Failed to generate unique QR code after 5 attempts");
  }

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: id,
    action: "qr_generated",
    before: { qrCodeValue: before.qrCodeValue },
    after: { qrCodeValue: qrCode },
  });

  return ok({ data: asset });
});
