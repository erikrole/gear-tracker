import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { cachedOk } from "@/lib/http";

export const GET = withAuth(async () => {
  const rows = await db.asset.groupBy({
    by: ["brand"],
    where: { brand: { not: "" } },
    orderBy: { brand: "asc" },
  });

  return cachedOk({ data: rows.map((r) => r.brand) });
});
