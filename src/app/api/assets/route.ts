export const runtime = "edge";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, parsePagination } from "@/lib/http";
import { enrichAssetsWithStatus } from "@/lib/services/status";

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
    const statusParam = searchParams.get("status");
    const locationId = searchParams.get("location_id");

    // Derived statuses (CHECKED_OUT, RESERVED) aren't stored — they need
    // post-enrichment filtering. Stored statuses filter at the DB level.
    const derivedStatuses = ["CHECKED_OUT", "RESERVED"];
    const isDerivedFilter = statusParam && derivedStatuses.includes(statusParam);
    const isStoredFilter = statusParam && !isDerivedFilter;

    const where = {
      ...(locationId ? { locationId } : {}),
      // For derived status filters, only look at AVAILABLE assets (those are
      // the only ones that can be CHECKED_OUT or RESERVED after enrichment).
      ...(isStoredFilter ? { status: statusParam as never } : {}),
      ...(isDerivedFilter ? { status: "AVAILABLE" as never } : {}),
      ...(q
        ? {
            OR: [
              { assetTag: { contains: q, mode: "insensitive" as const } },
              { brand: { contains: q, mode: "insensitive" as const } },
              { model: { contains: q, mode: "insensitive" as const } },
              { serialNumber: { contains: q, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const { limit, offset } = parsePagination(searchParams);

    if (isDerivedFilter) {
      // For derived status filters, fetch all matching assets, enrich, filter,
      // then paginate in-memory. This is acceptable for typical inventory sizes.
      const rawAll = await db.asset.findMany({
        where,
        include: { location: true },
        orderBy: { assetTag: "asc" }
      });

      let enriched;
      try {
        enriched = await enrichAssetsWithStatus(rawAll);
      } catch {
        enriched = rawAll.map((a) => ({ ...a, computedStatus: a.status as string }));
      }

      const filtered = enriched.filter((a) => a.computedStatus === statusParam);
      const total = filtered.length;
      const data = filtered.slice(offset, offset + limit);

      return ok({ data, total, limit, offset });
    }

    const [rawData, total] = await Promise.all([
      db.asset.findMany({
        where,
        include: { location: true },
        orderBy: { assetTag: "asc" },
        take: limit,
        skip: offset
      }),
      db.asset.count({ where })
    ]);

    let data;
    try {
      data = await enrichAssetsWithStatus(rawData);
    } catch {
      // If status enrichment fails (e.g. missing tables), return raw data
      data = rawData.map((a) => ({ ...a, computedStatus: a.status }));
    }

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
