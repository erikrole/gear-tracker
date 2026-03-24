import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { buildDerivedStatusWhere, enrichAssetsWithStatusFromLoaded } from "@/lib/services/status";
import type { Prisma } from "@prisma/client";

export const GET = withAuth(async (req, { user }) => {
  requirePermission(user.role, "asset", "create"); // ADMIN/STAFF only

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const showAccessories = searchParams.get("show_accessories") === "true";
  const statusParams = searchParams.getAll("status").filter(Boolean);
  const locationIds = searchParams.getAll("location_id").filter(Boolean);
  const categoryIds = searchParams.getAll("category_id").filter(Boolean);
  const brandParams = searchParams.getAll("brand").map((b) => b.trim()).filter(Boolean);
  const departmentIds = searchParams.getAll("department_id").filter(Boolean);

  const baseWhere: Prisma.AssetWhereInput = {
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
    ...(q
      ? {
          OR: [
            { assetTag: { contains: q, mode: "insensitive" as const } },
            { brand: { contains: q, mode: "insensitive" as const } },
            { model: { contains: q, mode: "insensitive" as const } },
            { serialNumber: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ]
        }
      : {})
  };

  let where: Prisma.AssetWhereInput;
  if (statusParams.length > 0) {
    const statusClauses = buildDerivedStatusWhere(statusParams);
    where = { AND: [baseWhere, { OR: statusClauses }] };
  } else {
    where = baseWhere;
  }

  const rawAssets = await db.asset.findMany({
    where,
    include: {
      location: { select: { name: true } },
      category: { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: { assetTag: "asc" },
    take: 5000, // Safety cap
  });

  let assets;
  try {
    assets = await enrichAssetsWithStatusFromLoaded(rawAssets);
  } catch {
    assets = rawAssets.map((a) => ({ ...a, computedStatus: a.status as string }));
  }

  // Build CSV
  const headers = ["Asset Tag", "Name", "Brand", "Model", "Serial Number", "Status", "Category", "Department", "Location", "Purchase Date", "Purchase Price"];
  const rows = assets.map((a) => [
    csvEscape(a.assetTag),
    csvEscape(a.name || ""),
    csvEscape(a.brand),
    csvEscape(a.model),
    csvEscape(a.serialNumber || ""),
    csvEscape(a.computedStatus),
    csvEscape(a.category?.name || ""),
    csvEscape(a.department?.name || ""),
    csvEscape(a.location?.name || ""),
    csvEscape(a.purchaseDate ? new Date(a.purchaseDate).toISOString().slice(0, 10) : ""),
    a.purchasePrice != null ? String(a.purchasePrice) : "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="items-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
