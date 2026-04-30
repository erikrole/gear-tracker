import { z } from "zod";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { buildDerivedStatusWhere, enrichAssetsWithStatusFromLoaded } from "@/lib/services/status";
import { BookingStatus, Prisma } from "@prisma/client";

const createAssetSchema = z.object({
  assetTag: z.string().min(1),
  name: z.string().max(500).optional(),
  type: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  serialNumber: z.string().optional(),
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
  parentAssetId: z.string().cuid().optional(),
  availableForReservation: z.boolean().optional(),
  availableForCheckout: z.boolean().optional(),
  availableForCustody: z.boolean().optional(),
  status: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]).default("AVAILABLE"),
  notes: z.string().max(10000).optional()
});

const assetInclude = {
  location: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  _count: { select: { accessories: true } },
};

/** Map sort param to Prisma orderBy clause. */
const SORT_MAP: Record<string, Prisma.AssetOrderByWithRelationInput> = {
  assetTag: { assetTag: "asc" },
  "-assetTag": { assetTag: "desc" },
  brand: { brand: "asc" },
  "-brand": { brand: "desc" },
  model: { model: "asc" },
  "-model": { model: "desc" },
  createdAt: { createdAt: "asc" },
  "-createdAt": { createdAt: "desc" },
  category: { category: { name: "asc" } },
  "-category": { category: { name: "desc" } },
  location: { location: { name: "asc" } },
  "-location": { location: { name: "desc" } },
  department: { department: { name: "asc" } },
  "-department": { department: { name: "desc" } },
};

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const qr = searchParams.get("qr")?.trim(); // exact QR code value for scan lookup
  const showAccessories = searchParams.get("show_accessories") === "true";
  const favoritesOnly = searchParams.get("favorites_only") === "true";

  // Support multi-value filters: ?status=A&status=B or single ?status=A
  const statusParams = searchParams.getAll("status").filter(Boolean);
  const locationIds = searchParams.getAll("location_id").filter(Boolean);
  const categoryIds = searchParams.getAll("category_id").filter(Boolean);
  const brandParams = searchParams.getAll("brand").map((b) => b.trim()).filter(Boolean);
  const departmentIds = searchParams.getAll("department_id").filter(Boolean);
  const missingField = searchParams.get("missing"); // "category" | "department"

  // Server-side sorting: ?sort=brand&order=desc or ?sort=-brand
  const sortParam = searchParams.get("sort") ?? "";
  const orderParam = searchParams.get("order") ?? "";
  const sortKey = orderParam === "desc" && sortParam && !sortParam.startsWith("-")
    ? `-${sortParam}`
    : sortParam || "assetTag";
  const orderBy = SORT_MAP[sortKey] ?? SORT_MAP["assetTag"];

  // Build base where clause (non-status filters)
  // QR scan lookup (?qr=) must find accessories too, so skip the parentAssetId filter
  const baseWhere: Prisma.AssetWhereInput = {
    ...(qr ? {} : showAccessories ? { parentAssetId: { not: null } } : { parentAssetId: null }),
    ...(favoritesOnly ? { favoritedBy: { some: { userId: user.id } } } : {}),
    ...(locationIds.length === 1 ? { locationId: locationIds[0] } : {}),
    ...(locationIds.length > 1 ? { locationId: { in: locationIds } } : {}),
    ...(missingField === "category" ? { categoryId: null } : categoryIds.length === 1 ? { categoryId: categoryIds[0] } : categoryIds.length > 1 ? { categoryId: { in: categoryIds } } : {}),
    ...(missingField === "department" ? { departmentId: null } : departmentIds.length === 1 ? { departmentId: departmentIds[0] } : departmentIds.length > 1 ? { departmentId: { in: departmentIds } } : {}),
    ...(brandParams.length === 1
      ? { brand: { equals: brandParams[0], mode: "insensitive" as const } }
      : brandParams.length > 1
        ? { brand: { in: brandParams, mode: "insensitive" as const } }
        : {}),
    ...(q || qr
      ? {
          OR: [
            ...(qr ? [
              { qrCodeValue: { equals: qr, mode: "insensitive" as const } },
              { qrCodeValue: { equals: `QR-${qr}`, mode: "insensitive" as const } },
              { primaryScanCode: { equals: qr, mode: "insensitive" as const } },
              { primaryScanCode: { equals: `QR-${qr}`, mode: "insensitive" as const } },
              { assetTag: { equals: qr, mode: "insensitive" as const } },
            ] : []),
            ...(q ? [
              { assetTag: { contains: q, mode: "insensitive" as const } },
              { brand: { contains: q, mode: "insensitive" as const } },
              { model: { contains: q, mode: "insensitive" as const } },
              { serialNumber: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
              { notes: { contains: q, mode: "insensitive" as const } },
              { category: { name: { contains: q, mode: "insensitive" as const } } },
              { location: { name: { contains: q, mode: "insensitive" as const } } },
              { department: { name: { contains: q, mode: "insensitive" as const } } },
            ] : []),
          ]
        }
      : {})
  };

  // Build status filter using DB-level derived status clauses
  let where: Prisma.AssetWhereInput;
  if (statusParams.length > 0) {
    const statusClauses = buildDerivedStatusWhere(statusParams);
    where = {
      AND: [
        baseWhere,
        { OR: statusClauses },
      ],
    };
  } else {
    where = baseWhere;
  }

  // ids-only mode: return matching asset IDs (capped) for "select all matching" flows.
  // Skips bulk items, favorites, breakdown — just the ids.
  if (searchParams.get("ids_only") === "true") {
    const cap = 5000;
    const rows = await db.asset.findMany({
      where,
      orderBy,
      take: cap + 1,
      select: { id: true },
    });
    const truncated = rows.length > cap;
    return ok({
      ids: rows.slice(0, cap).map((r) => r.id),
      truncated,
    });
  }

  const { limit, offset } = parsePagination(searchParams);

  const [rawData, total] = await Promise.all([
    db.asset.findMany({
      where,
      include: assetInclude,
      orderBy,
      take: limit,
      skip: offset,
    }),
    db.asset.count({ where }),
  ]);

  const data = await enrichAssetsWithStatusFromLoaded(rawData);

  const [enrichedWithBookings, favoriteItems] = await Promise.all([
    attachActiveBookings(data),
    db.favoriteItem.findMany({
      where: { userId: user.id, assetId: { in: data.map((a) => a.id) } },
      select: { assetId: true },
    }),
  ]);

  // Attach isFavorited for current user
  const favoriteAssetIds = new Set(favoriteItems.map((f) => f.assetId));
  const enrichedWithFavorites = enrichedWithBookings.map((a) => ({
    ...a,
    isFavorited: favoriteAssetIds.has(a.id),
  }));

  // Status breakdown counts using derived status logic
  const statusKeys = ["AVAILABLE", "CHECKED_OUT", "RESERVED", "MAINTENANCE", "RETIRED"] as const;
  const breakdownCounts = await Promise.all(
    statusKeys.map((s) => {
      const clauses = buildDerivedStatusWhere([s]);
      return db.asset.count({ where: { AND: [baseWhere, { OR: clauses }] } });
    })
  );

  // Fetch bulk items (only on first page and when not filtering accessories)
  let bulkItems: Array<{
    id: string;
    kind: "bulk";
    name: string;
    category: string;
    unit: string;
    onHandQuantity: number;
    availableQuantity: number;
    imageUrl: string | null;
    locationName: string;
    locationId: string;
    categoryId: string | null;
    binQrCodeValue: string;
  }> = [];

  if (offset === 0 && !showAccessories) {
    const bulkWhere: Prisma.BulkSkuWhereInput = {
      active: true,
      ...(locationIds.length === 1 ? { locationId: locationIds[0] } : {}),
      ...(locationIds.length > 1 ? { locationId: { in: locationIds } } : {}),
      ...(categoryIds.length === 1 ? { categoryId: categoryIds[0] } : {}),
      ...(categoryIds.length > 1 ? { categoryId: { in: categoryIds } } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { category: { contains: q, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const bulkSkus = await db.bulkSku.findMany({
      where: bulkWhere,
      include: {
        location: { select: { name: true } },
        balances: { select: { onHandQuantity: true } },
        bookingItems: {
          where: { booking: { status: "OPEN", kind: "CHECKOUT" } },
          select: { checkedOutQuantity: true },
        },
      },
      orderBy: { name: "asc" },
    });

    bulkItems = bulkSkus.map((sku) => {
      const onHand = sku.balances.reduce((sum, b) => sum + b.onHandQuantity, 0);
      const checkedOut = sku.bookingItems.reduce((sum, b) => sum + (b.checkedOutQuantity ?? 0), 0);
      return {
        id: sku.id,
        kind: "bulk" as const,
        name: sku.name,
        category: sku.category,
        unit: sku.unit,
        onHandQuantity: onHand,
        availableQuantity: Math.max(0, onHand - checkedOut),
        imageUrl: sku.imageUrl,
        locationName: sku.location.name,
        locationId: sku.locationId,
        categoryId: sku.categoryId,
        binQrCodeValue: sku.binQrCodeValue,
      };
    });
  }

  return ok({
    data: enrichedWithFavorites,
    bulkItems,
    total,
    limit,
    offset,
    statusBreakdown: {
      available: breakdownCounts[0],
      checkedOut: breakdownCounts[1],
      reserved: breakdownCounts[2],
      maintenance: breakdownCounts[3],
      retired: breakdownCounts[4],
    },
  });
});

/** Attach activeBooking (id, kind, title, requester) for CHECKED_OUT / RESERVED assets. */
async function attachActiveBookings<T extends { id: string; computedStatus: string }>(
  assets: T[]
): Promise<Array<T & { activeBooking: { id: string; kind: string; title: string; requesterName: string; isOverdue: boolean; endsAt: string } | null }>> {
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
  const bookingByAsset = new Map<string, { id: string; kind: string; title: string; requesterName: string; isOverdue: boolean; endsAt: string }>();
  for (const alloc of allocations) {
    if (!bookingByAsset.has(alloc.assetId)) {
      bookingByAsset.set(alloc.assetId, {
        id: alloc.booking.id,
        kind: alloc.booking.kind,
        title: alloc.booking.title,
        requesterName: alloc.booking.requester.name,
        isOverdue: alloc.booking.status === "OPEN" && alloc.booking.endsAt < now,
        endsAt: alloc.booking.endsAt.toISOString(),
      });
    }
  }

  return assets.map((a) => ({ ...a, activeBooking: bookingByAsset.get(a.id) ?? null }));
}

export const POST = withAuth(async (req, { user }) => {
  requirePermission(user.role, "asset", "create");
  const body = createAssetSchema.parse(await req.json());

  let asset;
  try {
    asset = await db.asset.create({
      data: {
        assetTag: body.assetTag,
        name: body.name ?? null,
        type: body.type,
        brand: body.brand,
        model: body.model,
        serialNumber: body.serialNumber?.trim() || null,
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
        parentAssetId: body.parentAssetId ?? null,
        availableForReservation: body.availableForReservation ?? true,
        availableForCheckout: body.availableForCheckout ?? true,
        availableForCustody: body.availableForCustody ?? true,
        status: body.status,
        notes: body.notes
      },
      include: {
        location: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: `Asset tag "${body.assetTag}" is already in use` },
        { status: 409 }
      );
    }
    throw error;
  }

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
