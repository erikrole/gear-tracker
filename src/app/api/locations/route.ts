export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export async function GET() {
  try {
    await requireAuth();
    const locations = await db.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return ok({ data: locations });
  } catch (error) {
    return fail(error);
  }
}
