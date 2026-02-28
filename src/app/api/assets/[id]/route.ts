export const runtime = "edge";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, HttpError, ok } from "@/lib/http";
import { deriveAssetStatus } from "@/lib/services/status";

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

function parseNotes(notes: string | null) {
  if (!notes) return null;
  try {
    return JSON.parse(notes) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const params = await ctx.params;

    const asset = await db.asset.findUnique({
      where: { id: params.id },
      include: {
        location: true,
        department: true,
        kitMemberships: { include: { kit: true } }
      }
    });

    if (!asset) {
      throw new HttpError(404, "Asset not found");
    }

    const [computedStatus, bookingHistory] = await Promise.all([
      deriveAssetStatus(params.id),
      db.bookingSerializedItem.findMany({
        where: { assetId: params.id },
        include: {
          booking: {
            include: {
              requester: { select: { id: true, name: true, email: true } },
              location: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: [{ createdAt: "desc" }],
        take: 100
      })
    ]);

    return ok({
      data: {
        ...asset,
        computedStatus,
        metadata: parseNotes(asset.notes),
        history: bookingHistory.map((entry) => ({
          id: entry.id,
          createdAt: entry.createdAt,
          booking: {
            id: entry.booking.id,
            kind: entry.booking.kind,
            status: entry.booking.status,
            title: entry.booking.title,
            startsAt: entry.booking.startsAt,
            endsAt: entry.booking.endsAt,
            requester: entry.booking.requester,
            location: entry.booking.location
          }
        }))
      }
    });
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
