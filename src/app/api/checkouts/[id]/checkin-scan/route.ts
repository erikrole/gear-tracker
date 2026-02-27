import { ScanType } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { fail, HttpError, ok } from "@/lib/http";
import { recordScan } from "@/lib/services/scans";
import { scanSchema } from "@/lib/validation";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAuth();
    const params = await ctx.params;
    const body = scanSchema.parse(await req.json());

    if (body.phase !== "CHECKIN") {
      throw new HttpError(400, "phase must be CHECKIN");
    }

    const result = await recordScan({
      bookingId: params.id,
      actorUserId: actor.id,
      phase: "CHECKIN",
      scanType: body.scanType as ScanType,
      scanValue: body.scanValue,
      quantity: body.quantity,
      deviceContext: body.deviceContext
    });

    return ok({ data: result });
  } catch (error) {
    return fail(error);
  }
}
