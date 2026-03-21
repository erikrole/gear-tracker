import { z } from "zod";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { ok, parsePagination } from "@/lib/http";
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
  warrantyDate: z.string().optional(),
  residualValue: z.number().nonnegative().optional(),
  locationId: z.string().cuid(),
  categoryId: z.string().cuid().optional(),
  departmentId: z.string().cuid().optional(),
  linkUrl: z.string().url().max(2000).optional(),
  uwAssetTag: z.string().max(200).optional(),
  status: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]).default("AVAILABLE"),
  notes: z.string().max(10000).optional()
});

const assetInclude = {
  location: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  _count: { select: { accessories: true } },
};

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const showAccessories = searchParams.get("show_accessories") === "true";

  // Support multi-value filters: ?status=A&status=B or single ?status=A
  const statusParams = searchParams.getAll("status").filter(Boolean);
  const locationIds = searchParams.getAll("location_id").filter(Boolean);
  const categoryIds = searchParams.getAll("category_id").filter(Boolean);
  const brandParams = searchParams.getAll("brand").map((b) => b.trim()).filter(Boolean);
  const departmentIds = searchParams.getAll("department_id").filter(Boolean);

  // Derived statuses (CHECKED_OUT, RESERVED) aren't stored — they need
  // post-enrichment filtering. Stored statuses filter at the DB level.
  const derivedStatuses = ["CHECKED_OUT", "RESERVED"];
  const derivedFilters = statusParams.filter((s) => derivedStatuses.includes(s));
  const storedFilters = statusParams.filter((s) => !derivedStatuses.includes(s));
  const hasDerived = derivedFilters.length > 0;
  const hasStored = storedFilters.length > 0;
  // If mixing derived + stored, we need post-enrichment filtering for derived.
  // DB-level: filter to stored statuses + AVAILABLE (source for derived).
  const dbStatusFilter = hasDerived && hasStored
    ? [...storedFilters, "AVAILABLE"]
    : hasDerived
      ? ["AVAILABLE"]
      : storedFilters;

  const where = {
    // By default, hide accessories (child items) from the main list
    ...(!showAccessories ? { parentAssetId: null } : {}),
    ...(locationIds.length === 1 ? { locationId: locationIds[0] } : {}),
    ...(locationIds.length > 1 ? { locationId: { in: locationIds } } : {}),
    ...(categoryIds.length === 1 ? { categoryId: categoryIds[0] } : {}),
    ...(categoryIds.length > 1 ? { categoryId: { in: categoryIds } } : {}),
    ...(departmentIds.length === 1 ? { departmentId: departmentIds[0] } : {}),
    ...(departmentIds.length > 1 ? { departmentId: { in: departmentIds } } : {}),
    ...(brandParams.length === 1
      ? { brand: { equals: brandParams[0], mode: "insensitive" as const } }
      : brandParams.length > 1
        ? { brand: { in: brandParams, mode: "insensitive" as const } }
        : {}),
    ...(dbStatusFilter.length === 1 ? { status: dbStatusFilter[0] as never } : {}),
    ...(dbStatusFilter.length > 1 ? { status: { in: dbStatusFilter } as never } : {}),
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

  if (hasDerived) {
    // For derived status filters, fetch matching assets, enrich, filter,
    // then paginate in-memory. Capped at 2000 to prevent memory issues on large inventories.
    const rawAll = await db.asset.findMany({
      where,
      include: assetInclude,
      orderBy: { assetTag: "asc" },
      take: 2000,
    });

    let enriched;
    try {
      enriched = await enrichAssetsWithStatus(rawAll);
    } catch {
      enriched = rawAll.map((a) => ({ ...a, computedStatus: a.status as string }));
    }

    const allowedStatuses = new Set(statusParams);
    const filtered = enriched.filter((a) => allowedStatuses.has(a.computedStatus));
    const total = filtered.length;
    const data = filtered.slice(offset, offset + limit);
    const dataWithBookings = await attachActiveBookings(data);

    return ok({ data: dataWithBookings, total, limit, offset });
  }

  const [rawData, total] = await Promise.all([
    db.asset.findMany({
      where,
      include: assetInclude,
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
});

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
        select: { id: true, kind: true, title: true, status: true, endsAt: true, requester: { select: { name: true } } },
      },
    },
  });

  const now = new Date();
  const bookingByAsset = new Map<string, { id: string; kind: string; title: string; requesterName: string; isOverdue: boolean }>();
  for (const alloc of allocations) {
    if (!bookingByAsset.has(alloc.assetId)) {
      bookingByAsset.set(alloc.assetId, {
        id: alloc.booking.id,
        kind: alloc.booking.kind,
        title: alloc.booking.title,
        requesterName: alloc.booking.requester.name,
        isOverdue: alloc.booking.status === "OPEN" && alloc.booking.endsAt < now,
      });
    }
  }

  return assets.map((a) => ({ ...a, activeBooking: bookingByAsset.get(a.id) ?? null }));
}

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "asset", "create");
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
      warrantyDate: body.warrantyDate ? new Date(body.warrantyDate) : null,
      residualValue: body.residualValue,
      locationId: body.locationId,
      categoryId: body.categoryId ?? null,
      departmentId: body.departmentId ?? null,
      linkUrl: body.linkUrl ?? null,
      uwAssetTag: body.uwAssetTag ?? null,
      status: body.status,
      notes: body.notes
    },
    include: {
      location: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    }
  });

  await createAuditEntry({
    actorId: user.id,
    actorRole: user.role,
    entityType: "asset",
    entityId: asset.id,
    action: "asset_created",
    after: { assetTag: asset.assetTag, brand: asset.brand, model: asset.model, locationId: asset.locationId },
  });

  return ok({ data: asset }, 201);
});
