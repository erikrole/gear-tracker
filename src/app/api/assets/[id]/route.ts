import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";

const patchAssetSchema = z
  .object({
    assetTag: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
    serialNumber: z.string().min(1).optional(),
    qrCodeValue: z.string().min(1).optional(),
    purchaseDate: z.string().optional(),
    purchasePrice: z.number().positive().optional(),
    locationId: z.string().cuid().optional(),
    status: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]).optional(),
    notes: z.string().max(10000).optional()
  })
  .strict();

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const params = await ctx.params;

    const asset = await db.asset.findUnique({
      where: { id: params.id },
      include: {
        location: true
      }
    });

    if (!asset) {
      throw new HttpError(404, "Asset not found");
    }

    return ok({ data: asset });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const params = await ctx.params;
    const body = patchAssetSchema.parse(await req.json());

    const asset = await db.asset.update({
      where: { id: params.id },
      data: {
        ...body,
        ...(body.purchaseDate ? { purchaseDate: new Date(body.purchaseDate) } : {})
      },
      include: {
        location: true
      }
    });

    return ok({ data: asset });
  } catch (error) {
    return fail(error);
  }
}
