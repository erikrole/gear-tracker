import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

export const GET = withAuth(async () => {
  const rows = await db.asset.groupBy({
    by: ["brand"],
    where: { brand: { not: "" } },
    orderBy: { brand: "asc" },
  });

  return ok({ data: rows.map((r) => r.brand) });
});
