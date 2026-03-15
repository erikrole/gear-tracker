export const runtime = "edge";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { enrichAssetsWithStatus } from "@/lib/services/status";
import { BookingStatus } from "@prisma/client";

const createAssetSchema = z.object({
  assetTag: z.string().min(1),
  name: z.string().max(500).optional(),
  type: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  serialNumber: z.string().min(1),
  qrCodeValue: z.string().min(1),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().positive().optional(),
  locationId: z.string().cuid(),
  categoryId: z.string().cuid().optional(),
  linkUrl: z.string().url().max(2000).optional(),
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
    const categoryId = searchParams.get("category_id");

    // Derived statuses (CHECKED_OUT, RESERVED) aren't stored — they need
    // post-enrichment filtering. Stored statuses filter at the DB level.
    const derivedStatuses = ["CHECKED_OUT", "RESERVED"];
    const isDerivedFilter = statusParam && derivedStatuses.includes(statusParam);
    const isStoredFilter = statusParam && !isDerivedFilter;

    const where = {
      ...(locationId ? { locationId } : {}),
      ...(categoryId ? { categoryId } : {}),
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
        include: {
          location: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
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
      const dataWithBookings = await attachActiveBookings(data);

      return ok({ data: dataWithBookings, total, limit, offset });
    }

    const [rawData, total] = await Promise.all([
      db.asset.findMany({
        where,
        include: {
          location: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
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

    const enrichedWithBookings = await attachActiveBookings(data);
    return ok({ data: enrichedWithBookings, total, limit, offset });
  } catch (error) {
    return fail(error);
  }
}

/** Attach activeBooking (id, kind, title, requester) for CHECKED_OUT / RESERVED assets. */
async function attachActiveBookings<T extends { id: string; computedStatus: string }>(
  assets: T[]
): Promise<Array<T & { activeBooking: { id: string; kind: string; title: string; requesterName: string } | null }>> {
  const needsBooking = assets.filter(
    (a) => a.computedStatus === "CHECKED_OUT" || a.computedStatus === "RESERVED"
  );

  if (needsBooking.length === 0) {
    return assets.map((a) => ({ ...a, activeBooking: null }));
  }

  const allocations = await db.assetAllocation.findMany({
    where: {
      assetId: { in: needsBooking.map((a) => a.id) },
      active: true,
      booking: { status: { in: [BookingStatus.OPEN, BookingStatus.BOOKED] } },
    },
    select: {
      assetId: true,
      booking: {
        select: { id: true, kind: true, title: true, requester: { select: { name: true } } },
      },
    },
  });

  const bookingByAsset = new Map<string, { id: string; kind: string; title: string; requesterName: string }>();
  for (const alloc of allocations) {
    if (!bookingByAsset.has(alloc.assetId)) {
      bookingByAsset.set(alloc.assetId, {
        id: alloc.booking.id,
        kind: alloc.booking.kind,
        title: alloc.booking.title,
        requesterName: alloc.booking.requester.name,
      });
    }
  }

  return assets.map((a) => ({ ...a, activeBooking: bookingByAsset.get(a.id) ?? null }));
}

export async function POST(req: Request) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "asset", "create");
    const body = createAssetSchema.parse(await req.json());

    const asset = await db.asset.create({
      data: {
        assetTag: body.assetTag,
        name: body.name ?? null,
        type: body.type,
        brand: body.brand,
        model: body.model,
        serialNumber: body.serialNumber,
        qrCodeValue: body.qrCodeValue,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        purchasePrice: body.purchasePrice,
        locationId: body.locationId,
        categoryId: body.categoryId ?? null,
        linkUrl: body.linkUrl ?? null,
        status: body.status,
        notes: body.notes
      },
      include: {
        location: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      }
    });

    return ok({ data: asset }, 201);
  } catch (error) {
    return fail(error);
  }
}
