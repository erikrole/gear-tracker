import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { cachedOk } from "@/lib/http";
import { requirePermissionOrCollaboratorCapability } from "@/lib/rbac";

export const GET = withAuth(async (_req, { user }) => {
  requirePermissionOrCollaboratorCapability(user, "asset", "view", "GEAR_CATALOG_VIEW");
  const rows = await db.asset.groupBy({
    by: ["brand"],
    where: { brand: { not: "" } },
    orderBy: { brand: "asc" },
  });

  return cachedOk({ data: rows.map((r) => r.brand) });
});
