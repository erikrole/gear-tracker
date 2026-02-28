export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  try {
    const actor = await requireAuth();
    requireRole(actor.role, ["ADMIN"]);

    const users = await db.user.findMany({
      orderBy: { name: "asc" },
      include: {
        location: {
          select: { name: true }
        }
      }
    });

    return ok({
      data: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location?.name ?? null
      }))
    });
  } catch (error) {
    return fail(error);
  }
}
