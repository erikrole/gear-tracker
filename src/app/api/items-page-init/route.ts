import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { cachedOk } from "@/lib/http";

function settledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string,
  partialFailures: string[],
): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[items-page-init] ${label} failed`, result.reason);
  partialFailures.push(label);
  return fallback;
}

/**
 * Consolidated endpoint for the items list page.
 * Returns user role, locations, departments, categories, and brands
 * in a single round-trip instead of 4 separate fetches.
 */
export const GET = withAuth(async (_req, { user }) => {
  const [
    locationsResult,
    departmentsResult,
    categoriesResult,
    brandRowsResult,
    kitsResult,
  ] = await Promise.allSettled([
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
    db.kit.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const partialFailures: string[] = [];
  const locations = settledValue(locationsResult, [] as Array<{ id: string; name: string }>, "locations", partialFailures);
  const departments = settledValue(departmentsResult, [] as Array<{ id: string; name: string }>, "departments", partialFailures);
  const categories = settledValue(categoriesResult, [] as Array<{ id: string; name: string; parentId: string | null }>, "categories", partialFailures);
  const brandRows = settledValue(brandRowsResult, [] as Array<{ brand: string }>, "brands", partialFailures);
  const kits = settledValue(kitsResult, [] as Array<{ id: string; name: string }>, "kits", partialFailures);

  return cachedOk({
    data: {
      user: { role: user.role },
      locations,
      departments,
      categories,
      brands: brandRows.map((r) => r.brand),
      kits,
    },
    partialFailures,
  });
});
