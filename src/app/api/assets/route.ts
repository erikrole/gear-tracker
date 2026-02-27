import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, parsePagination } from "@/lib/http";

const createAssetSchema = z.object({
  assetTag: z.string().min(1),
  type: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  serialNumber: z.string().min(1),
  qrCodeValue: z.string().min(1),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().positive().optional(),
  locationId: z.string().cuid(),
  status: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]).default("AVAILABLE"),
  notes: z.string().max(10000).optional()
});

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    const where = {
      ...(searchParams.get("location_id") ? { locationId: searchParams.get("location_id")! } : {}),
      ...(searchParams.get("status") ? { status: searchParams.get("status") as never } : {}),
      ...(q
        ? {
            OR: [
              { assetTag: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { model: { contains: q, mode: "insensitive" } },
              { serialNumber: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const { limit, offset } = parsePagination(searchParams);

    const [data, total] = await Promise.all([
      db.asset.findMany({
        where,
        include: { location: true },
        orderBy: { assetTag: "asc" },
        take: limit,
        skip: offset
      }),
      db.asset.count({ where })
    ]);

    return ok({ data, total, limit, offset });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth();
    const body = createAssetSchema.parse(await req.json());

    const asset = await db.asset.create({
      data: {
        assetTag: body.assetTag,
        type: body.type,
        brand: body.brand,
        model: body.model,
        serialNumber: body.serialNumber,
        qrCodeValue: body.qrCodeValue,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        purchasePrice: body.purchasePrice,
        locationId: body.locationId,
        status: body.status,
        notes: body.notes
      },
      include: {
        location: true
      }
    });

    return ok({ data: asset }, 201);
  } catch (error) {
    return fail(error);
  }
}
