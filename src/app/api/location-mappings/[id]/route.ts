export const runtime = "edge";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "location_mapping", "delete");
    const { id } = await params;
    await db.locationMapping.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
