import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { ok } from "@/lib/http";

export const GET = withAuth(async () => {
  const locations = await db.location.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return ok({ data: locations });
});
