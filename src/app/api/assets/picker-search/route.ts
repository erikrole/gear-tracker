/**
 * Dedicated search endpoint for the equipment picker.
 *
 * Returns paginated assets with computed status, filtered by section and
 * text search. Also returns section counts as metadata so tab badges
 * are always accurate without loading the full asset list.
 */
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok, parsePagination } from "@/lib/http";
import { Prisma } from "@prisma/client";
import { enrichAssetsWithStatusFromLoaded } from "@/lib/services/status";
import { sectionWhere, ALL_SECTION_KEYS } from "@/lib/equipment-section-filters";
import type { EquipmentSectionKey } from "@/lib/equipment-sections";

const VALID_SECTIONS = new Set<string>(ALL_SECTION_KEYS);

const pickerSelect = {
  id: true,
  assetTag: true,
  name: true,
  type: true,
  brand: true,
  model: true,
  serialNumber: true,
  status: true,
  locationId: true,
  qrCodeValue: true,
  primaryScanCode: true,
  imageUrl: true,
  location: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.AssetSelect;

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const qr = searchParams.get("qr")?.trim() || undefined;
  const sectionParam = searchParams.get("section")?.trim();
  const onlyAvailable = searchParams.get("only_available") !== "false";
  const idsParam = searchParams.get("ids")?.trim();

  const section = sectionParam && VALID_SECTIONS.has(sectionParam)
    ? (sectionParam as EquipmentSectionKey)
    : undefined;

  const ids = idsParam ? idsParam.split(",").filter(Boolean) : undefined;

  const { limit, offset } = parsePagination(searchParams);

  // Build WHERE clause
  const conditions: Prisma.AssetWhereInput[] = [
    { parentAssetId: null }, // exclude accessories
  ];

  // Exclude retired unless specifically fetching by IDs
  if (!ids) {
    conditions.push({ status: { not: "RETIRED" } });
  }

  if (onlyAvailable && !ids && !qr) {
    conditions.push({ status: "AVAILABLE" });
  }

  if (section) {
    conditions.push(sectionWhere(section));
  }

  // Exact QR/scan code lookup (for scan-to-add)
  // Also try QR-{value} prefix since generated codes use "QR-XXXX" format
  if (qr) {
    const qrPrefixed = `QR-${qr}`;
    conditions.push({
      OR: [
        { qrCodeValue: { equals: qr, mode: "insensitive" } },
        { qrCodeValue: { equals: qrPrefixed, mode: "insensitive" } },
        { primaryScanCode: { equals: qr, mode: "insensitive" } },
        { primaryScanCode: { equals: qrPrefixed, mode: "insensitive" } },
        { assetTag: { equals: qr, mode: "insensitive" } },
      ],
    });
  }

  // Fetch by specific IDs (for hydrating selected items)
  if (ids && ids.length > 0) {
    conditions.push({ id: { in: ids } });
  }

  // Text search across key fields
  if (q) {
    conditions.push({
      OR: [
        { assetTag: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { type: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.AssetWhereInput = { AND: conditions };

  // Fetch assets + count in parallel
  const [rawAssets, total] = await Promise.all([
    db.asset.findMany({
      where,
      select: pickerSelect,
      orderBy: { assetTag: "asc" },
      take: limit,
      skip: offset,
    }),
    db.asset.count({ where }),
  ]);

  // Enrich with computed status (CHECKED_OUT, RESERVED, etc.)
  let assets;
  try {
    assets = await enrichAssetsWithStatusFromLoaded(rawAssets);
  } catch {
    assets = rawAssets.map((a) => ({ ...a, computedStatus: a.status as string }));
  }

  // Flatten category name for client-side section classification
  const assetsWithCategory = assets.map((a) => ({
    ...a,
    categoryName: a.category?.name ?? null,
  }));

  // Section counts: how many non-retired assets per section (for tab badges)
  // Only compute when not doing a specific ID or QR lookup
  let sectionCounts: Record<string, number> | undefined;
  if (!ids && !qr) {
    const baseConditions: Prisma.AssetWhereInput[] = [
      { parentAssetId: null },
      { status: { not: "RETIRED" } },
    ];
    if (onlyAvailable) {
      baseConditions.push({ status: "AVAILABLE" });
    }

    const countResults = await Promise.all(
      ALL_SECTION_KEYS.map((key) =>
        db.asset.count({
          where: { AND: [...baseConditions, sectionWhere(key)] },
        })
      )
    );

    sectionCounts = Object.fromEntries(
      ALL_SECTION_KEYS.map((key, i) => [key, countResults[i]])
    );
  }

  return ok({
    data: {
      assets: assetsWithCategory,
      total,
      sectionCounts: sectionCounts ?? null,
    },
  });
});
