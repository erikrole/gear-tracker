import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { requirePermission } from "@/lib/rbac";
import { createAuditEntry } from "@/lib/audit";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    requirePermission(actor.role, "location_mapping", "delete");
    const { id } = await params;
    await db.locationMapping.delete({ where: { id } });

    await createAuditEntry({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "location_mapping",
      entityId: id,
      action: "delete",
    });

    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
