export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

function randomHex(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.role !== "STAFF") {
      throw new HttpError(403, "Forbidden");
    }

    const { id } = await ctx.params;
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

    await db.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "asset",
        entityId: id,
        action: "qr_generated",
        beforeJson: { qrCodeValue: before.qrCodeValue },
        afterJson: { qrCodeValue: qrCode },
      },
    });

    return ok({ data: asset });
  } catch (error) {
    return fail(error);
  }
}
