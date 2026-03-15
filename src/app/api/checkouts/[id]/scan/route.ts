export const runtime = "edge";
import { ScanType } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, HttpError } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { recordScan } from "@/lib/services/scans";
import { scanSchema } from "@/lib/validation";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "checkout", "scan");
    const params = await ctx.params;

    // Students can only scan on their own checkouts
    if (actor.role === "STUDENT") {
      const booking = await db.booking.findUnique({
        where: { id: params.id },
        select: { requesterUserId: true, createdBy: true },
      });
      if (!booking || (booking.requesterUserId !== actor.id && booking.createdBy !== actor.id)) {
        throw new HttpError(403, "You can only scan items on your own checkouts");
      }
    }

    const body = scanSchema.parse(await req.json());

    const result = await recordScan({
      bookingId: params.id,
      actorUserId: actor.id,
      phase: body.phase,
      scanType: body.scanType as ScanType,
      scanValue: body.scanValue,
      quantity: body.quantity,
      unitNumbers: body.unitNumbers,
      deviceContext: body.deviceContext
    });

    return ok({ data: result });
  } catch (error) {
    return fail(error);
  }
}
