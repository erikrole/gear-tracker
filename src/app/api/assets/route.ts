import { z } from "zod";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { createAuditEntry } from "@/lib/audit";
import { db } from "@/lib/db";
import { ok, parsePagination } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { buildDerivedStatusWhere, enrichAssetsWithStatusFromLoaded } from "@/lib/services/status";
import { parseDerivedBulkUnitQr } from "@/lib/bulk-unit-qr";
import { BookingKind, BookingStatus, Prisma } from "@prisma/client";

const departmentIdSchema = z.string().min(1);

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
  departmentId: departmentIdSchema.optional(),
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
  const { limit, offset } = parsePagination(searchParams);

  // Server-side sorting: ?sort=brand&order=desc or ?sort=-brand
  const sortParam = searchParams.get("sort") ?? "";
  const orderParam = searchParams.get("order") ?? "";
  const sortKey = orderParam === "desc" && sortParam && !sortParam.startsWith("-")
    ? `-${sortParam}`
    : sortParam || "assetTag";
  const orderBy = SORT_MAP[sortKey] ?? SORT_MAP["assetTag"];

  const derivedBulkUnitQr = qr
    ? parseDerivedBulkUnitQr(
        qr,
        await db.bulkSku.findMany({
          where: { active: true, trackByNumber: true },
          select: { id: true, binQrCodeValue: true, trackByNumber: true },
        }),
      )
    : null;

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

  if (missingField === "category" || missingField === "department") {
    const [assetGaps, bulkGaps] = await Promise.all([
      db.asset.findMany({
        where,
        orderBy,
        select: {
          id: true,
          assetTag: true,
          name: true,
          brand: true,
          model: true,
          categoryId: true,
          category: { select: { name: true } },
          imageUrl: true,
        },
      }),
      db.bulkSku.findMany({
        where: {
          active: true,
          ...(locationIds.length === 1 ? { locationId: locationIds[0] } : {}),
          ...(locationIds.length > 1 ? { locationId: { in: locationIds } } : {}),
          ...(missingField === "category" ? { categoryId: null } : {}),
          ...(missingField === "department" ? { departmentId: null } : {}),
          ...(q ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { category: { contains: q, mode: "insensitive" as const } },
            ],
          } : {}),
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          category: true,
          categoryId: true,
          imageUrl: true,
        },
      }),
    ]);

    const departmentSuggestionByCategory = new Map<string, string>();
    if (missingField === "department") {
      const categoryIds = [
        ...new Set(
          [
            ...assetGaps.map((asset) => asset.categoryId),
            ...bulkGaps.map((sku) => sku.categoryId),
          ].filter((id): id is string => Boolean(id))
        ),
      ];
      const categoryNames = [
        ...new Set(
          bulkGaps
            .map((sku) => sku.category)
            .filter((name): name is string => Boolean(name?.trim()))
        ),
      ];

      if (categoryIds.length > 0 || categoryNames.length > 0) {
        const assetSourceWhere: Prisma.AssetWhereInput = {
          departmentId: { not: null },
          OR: [
            ...(categoryIds.length > 0 ? [{ categoryId: { in: categoryIds } }] : []),
            ...(categoryNames.length > 0
              ? [{ category: { name: { in: categoryNames, mode: "insensitive" as const } } }]
              : []),
          ],
        };
        const bulkSourceWhere: Prisma.BulkSkuWhereInput = {
          departmentId: { not: null },
          OR: [
            ...(categoryIds.length > 0 ? [{ categoryId: { in: categoryIds } }] : []),
            ...(categoryNames.length > 0
              ? [{ category: { in: categoryNames, mode: "insensitive" as const } }]
              : []),
          ],
        };
        const [assetSources, bulkSources] = await Promise.all([
          db.asset.findMany({
            where: assetSourceWhere,
            select: { categoryId: true, category: { select: { name: true } }, departmentId: true },
          }),
          db.bulkSku.findMany({
            where: bulkSourceWhere,
            select: { categoryId: true, category: true, departmentId: true },
          }),
        ]);

        const counts = new Map<string, Map<string, number>>();
        for (const source of assetSources) {
          if (!source.departmentId) continue;
          for (const key of getCategorySuggestionKeys(source.categoryId, source.category?.name ?? null)) {
            const categoryCounts = counts.get(key) ?? new Map<string, number>();
            categoryCounts.set(source.departmentId, (categoryCounts.get(source.departmentId) ?? 0) + 1);
            counts.set(key, categoryCounts);
          }
        }
        for (const source of bulkSources) {
          if (!source.departmentId) continue;
          for (const key of getCategorySuggestionKeys(source.categoryId, source.category)) {
            const categoryCounts = counts.get(key) ?? new Map<string, number>();
            categoryCounts.set(source.departmentId, (categoryCounts.get(source.departmentId) ?? 0) + 1);
            counts.set(key, categoryCounts);
          }
        }

        for (const [categoryKey, categoryCounts] of counts) {
          const [departmentId] = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
          if (departmentId) departmentSuggestionByCategory.set(categoryKey, departmentId);
        }
      }
    }

    const gapItems = [
      ...assetGaps.map((asset) => ({
        kind: "asset" as const,
        id: asset.id,
        assetTag: asset.assetTag,
        name: asset.name,
        brand: asset.brand,
        model: asset.model,
        imageUrl: asset.imageUrl,
        suggestedDepartmentId: departmentSuggestionByCategory.get(getCategorySuggestionKey(asset.categoryId, asset.category?.name ?? null) ?? "") ?? null,
      })),
      ...bulkGaps.map((sku) => ({
        kind: "bulk" as const,
        id: sku.id,
        assetTag: sku.name,
        name: sku.category,
        brand: "Bulk",
        model: "SKU",
        imageUrl: sku.imageUrl,
        suggestedDepartmentId: departmentSuggestionByCategory.get(getCategorySuggestionKey(sku.categoryId, sku.category) ?? "") ?? null,
      })),
    ].sort((a, b) => a.assetTag.localeCompare(b.assetTag, undefined, { numeric: true, sensitivity: "base" }));

    return ok({
      data: gapItems.slice(offset, offset + limit),
      bulkItems: [],
      total: gapItems.length,
      limit,
      offset,
      statusBreakdown: {
        available: 0,
        checkedOut: 0,
        pendingPickup: 0,
        reserved: 0,
        maintenance: 0,
        retired: 0,
      },
    });
  }

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
  const statusKeys = ["AVAILABLE", "CHECKED_OUT", "PENDING_PICKUP", "RESERVED", "MAINTENANCE", "RETIRED"] as const;
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
    trackByNumber: boolean;
    onHandQuantity: number;
    availableQuantity: number;
    checkedOutQuantity: number;
    lostQuantity: number;
    retiredQuantity: number;
    matchedUnitNumber?: number;
    matchedUnitStatus?: string;
    matchedUnitHolder?: string | null;
    matchedUnitDueAt?: string | null;
    matchedUnitBookingTitle?: string | null;
    imageUrl: string | null;
    locationName: string;
    locationId: string;
    categoryId: string | null;
    departmentId: string | null;
    departmentName: string | null;
    binQrCodeValue: string;
  }> = [];

  if (offset === 0 && !showAccessories) {
    const bulkWhere: Prisma.BulkSkuWhereInput = {
      active: true,
      ...(locationIds.length === 1 ? { locationId: locationIds[0] } : {}),
      ...(locationIds.length > 1 ? { locationId: { in: locationIds } } : {}),
      ...(categoryIds.length === 1 ? { categoryId: categoryIds[0] } : {}),
      ...(categoryIds.length > 1 ? { categoryId: { in: categoryIds } } : {}),
      ...(departmentIds.length === 1 ? { departmentId: departmentIds[0] } : {}),
      ...(departmentIds.length > 1 ? { departmentId: { in: departmentIds } } : {}),
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { category: { contains: q, mode: "insensitive" as const } },
        ],
      } : {}),
      ...(qr ? {
        OR: [
          { binQrCodeValue: { equals: qr, mode: "insensitive" as const } },
          { binQrCodeValue: { equals: `QR-${qr}`, mode: "insensitive" as const } },
          ...(derivedBulkUnitQr ? [{ id: derivedBulkUnitQr.bulkSkuId }] : []),
        ],
      } : {}),
    };

    const bulkSkus = await db.bulkSku.findMany({
      where: bulkWhere,
      include: {
        location: { select: { name: true } },
        department: { select: { id: true, name: true } },
        balances: { select: { onHandQuantity: true } },
        units: { select: { id: true, unitNumber: true, status: true } },
      },
      orderBy: { name: "asc" },
    });

    const matchedUnitId = derivedBulkUnitQr
      ? bulkSkus
          .find((sku) => sku.id === derivedBulkUnitQr.bulkSkuId)
          ?.units.find((unit) => unit.unitNumber === derivedBulkUnitQr.unitNumber)
          ?.id
      : null;
    const matchedUnitAllocation = matchedUnitId
      ? await db.bookingBulkUnitAllocation.findFirst({
          where: {
            bulkSkuUnitId: matchedUnitId,
            checkedOutAt: { not: null },
            checkedInAt: null,
          },
          select: {
            bookingBulkItem: {
              select: {
                booking: {
                  select: {
                    title: true,
                    endsAt: true,
                    requester: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { checkedOutAt: "desc" },
        })
      : null;
    const matchedUnitBooking = matchedUnitAllocation?.bookingBulkItem.booking;

    bulkItems = bulkSkus.map((sku) => {
      const balanceOnHand = sku.balances.reduce((sum, b) => sum + b.onHandQuantity, 0);
      const checkedOutQuantity = sku.trackByNumber
        ? sku.units.filter((unit) => unit.status === "CHECKED_OUT").length
        : 0;
      const lostQuantity = sku.trackByNumber
        ? sku.units.filter((unit) => unit.status === "LOST").length
        : 0;
      const retiredQuantity = sku.trackByNumber
        ? sku.units.filter((unit) => unit.status === "RETIRED").length
        : 0;
      const availableQuantity = sku.trackByNumber
        ? sku.units.filter((unit) => unit.status === "AVAILABLE").length
        : Math.max(0, balanceOnHand);
      const onHand = sku.trackByNumber
        ? sku.units.length
        : balanceOnHand;
      const matchedUnit = derivedBulkUnitQr?.bulkSkuId === sku.id
        ? sku.units.find((unit) => unit.unitNumber === derivedBulkUnitQr.unitNumber)
        : null;
      const matchedUnitCustody = matchedUnit && matchedUnit.id === matchedUnitId && matchedUnitBooking
        ? {
            matchedUnitHolder: matchedUnitBooking.requester.name,
            matchedUnitDueAt: matchedUnitBooking.endsAt.toISOString(),
            matchedUnitBookingTitle: matchedUnitBooking.title,
          }
        : {};
      return {
        id: sku.id,
        kind: "bulk" as const,
        name: sku.name,
        category: sku.category,
        unit: sku.unit,
        trackByNumber: sku.trackByNumber,
        onHandQuantity: onHand,
        availableQuantity,
        checkedOutQuantity,
        lostQuantity,
        retiredQuantity,
        ...(matchedUnit
          ? {
              matchedUnitNumber: matchedUnit.unitNumber,
              matchedUnitStatus: matchedUnit.status,
              ...matchedUnitCustody,
            }
          : {}),
        imageUrl: sku.imageUrl,
        locationName: sku.location.name,
        locationId: sku.locationId,
        categoryId: sku.categoryId,
        departmentId: sku.departmentId,
        departmentName: sku.department?.name ?? null,
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
      pendingPickup: breakdownCounts[2],
      reserved: breakdownCounts[3],
      maintenance: breakdownCounts[4],
      retired: breakdownCounts[5],
    },
  });
});

/** Attach activeBooking (id, kind, title, requester) for active derived booking states. */
async function attachActiveBookings<T extends { id: string; computedStatus: string }>(
  assets: T[]
): Promise<Array<T & { activeBooking: { id: string; kind: string; status: string; title: string; requesterName: string; requesterAvatarUrl: string | null; isOverdue: boolean; endsAt: string } | null }>> {
  const needsBooking = assets.filter(
    (a) => a.computedStatus === "CHECKED_OUT" || a.computedStatus === "PENDING_PICKUP" || a.computedStatus === "RESERVED"
  );

  if (needsBooking.length === 0) {
    return assets.map((a) => ({ ...a, activeBooking: null }));
  }

  const allocations = await db.assetAllocation.findMany({
    where: {
      assetId: { in: needsBooking.map((a) => a.id) },
      active: true,
      booking: { status: { in: [BookingStatus.OPEN, BookingStatus.PENDING_PICKUP, BookingStatus.BOOKED] } },
    },
    select: {
      assetId: true,
      startsAt: true,
      booking: {
        select: { id: true, kind: true, title: true, status: true, endsAt: true, requester: { select: { name: true, avatarUrl: true } } },
      },
    },
  });

  const now = new Date();
  const statusByAssetId = new Map(needsBooking.map((asset) => [asset.id, asset.computedStatus]));
  const bookingByAsset = new Map<string, { id: string; kind: string; status: string; title: string; requesterName: string; requesterAvatarUrl: string | null; isOverdue: boolean; endsAt: string }>();
  for (const alloc of allocations) {
    const computedStatus = statusByAssetId.get(alloc.assetId);
    const matchesDerivedStatus =
      (computedStatus === "CHECKED_OUT" && alloc.booking.kind === BookingKind.CHECKOUT && alloc.booking.status === BookingStatus.OPEN) ||
      (computedStatus === "PENDING_PICKUP" && alloc.booking.kind === BookingKind.CHECKOUT && alloc.booking.status === BookingStatus.PENDING_PICKUP) ||
      (computedStatus === "RESERVED" && alloc.booking.kind === BookingKind.RESERVATION && alloc.booking.status === BookingStatus.BOOKED && alloc.startsAt <= now);

    if (matchesDerivedStatus && !bookingByAsset.has(alloc.assetId)) {
      bookingByAsset.set(alloc.assetId, {
        id: alloc.booking.id,
        kind: alloc.booking.kind,
        status: alloc.booking.status,
        title: alloc.booking.title,
        requesterName: alloc.booking.requester.name,
        requesterAvatarUrl: alloc.booking.requester.avatarUrl ?? null,
        isOverdue: alloc.booking.status === "OPEN" && alloc.booking.endsAt < now,
        endsAt: alloc.booking.endsAt.toISOString(),
      });
    }
  }

  return assets.map((a) => ({ ...a, activeBooking: bookingByAsset.get(a.id) ?? null }));
}

function getCategorySuggestionKey(categoryId: string | null, categoryName: string | null) {
  return getCategorySuggestionKeys(categoryId, categoryName)[0] ?? null;
}

function getCategorySuggestionKeys(categoryId: string | null, categoryName: string | null) {
  const keys: string[] = [];
  if (categoryId) keys.push(`id:${categoryId}`);
  const normalizedName = categoryName?.trim().toLowerCase();
  if (normalizedName) keys.push(`name:${normalizedName}`);
  return keys;
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
