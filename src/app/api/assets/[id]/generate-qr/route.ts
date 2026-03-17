import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "asset", "generate_qr");

  const { id } = params;
  const before = await db.asset.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "Asset not found");

  // Generate unique QR code with collision retry
  let qrCode: string;
  let attempts = 0;
  do {
    qrCode = `QR-${randomHex(8).toUpperCase()}`;
    const existing = await db.asset.findUnique({ where: { qrCodeValue: qrCode } });
    if (!existing) break;
    attempts++;
  } while (attempts < 5);

  if (attempts >= 5) {
    throw new HttpError(500, "Failed to generate unique QR code");
  }

  const asset = await db.asset.update({
    where: { id },
    data: { qrCodeValue: qrCode },
    include: { location: true, category: true },
  });

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
