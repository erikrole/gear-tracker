import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export async function GET() {
  try {
    await requireAuth();

    const rows = await db.asset.groupBy({
      by: ["brand"],
      where: { brand: { not: "" } },
      orderBy: { brand: "asc" },
    });

    return ok({ data: rows.map((r) => r.brand) });
  } catch (error) {
    return fail(error);
  }
}
