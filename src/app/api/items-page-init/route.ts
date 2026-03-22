import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

/**
 * Consolidated endpoint for the items list page.
 * Returns user role, locations, departments, categories, and brands
 * in a single round-trip instead of 4 separate fetches.
 */
export const GET = withAuth(async (_req, { user }) => {
  const [locations, departments, categories, brandRows] = await Promise.all([
    db.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, parentId: true },
    }),
    db.asset.groupBy({
      by: ["brand"],
      where: { brand: { not: "" } },
      orderBy: { brand: "asc" },
    }),
  ]);

  return ok({
    data: {
      user: { role: user.role },
      locations,
      departments,
      categories,
      brands: brandRows.map((r) => r.brand),
    },
  });
});
