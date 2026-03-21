import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { enrichAssetsWithStatus } from "@/lib/services/status";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const locationId = searchParams.get("location_id");
  const categoryId = searchParams.get("category_id");
  const brand = searchParams.get("brand")?.trim();
  const departmentId = searchParams.get("department_id");

  const where = {
    parentAssetId: null,
    ...(locationId ? { locationId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(brand ? { brand: { equals: brand, mode: "insensitive" as const } } : {}),
    ...(status && !["CHECKED_OUT", "RESERVED"].includes(status) ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { assetTag: { contains: q, mode: "insensitive" as const } },
            { brand: { contains: q, mode: "insensitive" as const } },
            { model: { contains: q, mode: "insensitive" as const } },
            { serialNumber: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const rawData = await db.asset.findMany({
    where,
    include: {
      location: { select: { name: true } },
      category: { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: { assetTag: "asc" },
    take: 10000,
  });

  let data;
  try {
    data = await enrichAssetsWithStatus(rawData);
  } catch {
    data = rawData.map((a) => ({ ...a, computedStatus: a.status }));
  }

  const headers = [
    "Asset Tag", "Brand", "Model", "Serial Number", "Status",
    "Category", "Location", "Department", "Created At",
  ];

  const rows = data.map((a) => [
    a.assetTag,
    a.brand,
    a.model,
    a.serialNumber,
    a.computedStatus,
    a.category?.name ?? "",
    a.location?.name ?? "",
    a.department?.name ?? "",
    a.createdAt ? new Date(a.createdAt).toISOString().split("T")[0] : "",
  ]);

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => r.map(escapeCsv).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="items-export-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
});
